import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SummaryResult {
  summary: string;
  summarySource: 'llm' | 'extractive' | 'feed_description';
}

export interface EnrichResult {
  summary: string;
  category: string;   // 単一カテゴリ
  tags: string[];
  summarySource: 'llm';
}

/** 要約に使うLLMプロバイダ設定 */
export interface LlmConfig {
  provider: 'groq' | 'openai' | 'gemini';
  apiKey: string;
  baseUrl?: string;   // OpenAI互換のときのみ
  model?: string;
}

const CATEGORIES = ['AI', '制度', '社会×データ', '学術', '新事業'] as const;

/** 環境変数から使用プロバイダを決定（優先: Groq > OpenAI > Gemini） */
export function getLlmConfig(dbGeminiKey?: string): LlmConfig | null {
  if (process.env.GROQ_API_KEY) {
    return { provider: 'groq', apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini' };
  }
  const gk = process.env.GEMINI_API_KEY || dbGeminiKey;
  if (gk) return { provider: 'gemini', apiKey: gk };
  return null;
}

/** Promiseにタイムアウトを付ける（外部呼び出しのハング防止） */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => { t = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}


/** 直近LLM呼び出し時刻（TPM制限を避けるための最小間隔スロットル） */
let lastLlmAt = 0;
const MIN_LLM_GAP_MS = Number(process.env.LLM_MIN_GAP_MS || 6000);
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function throttleLlm() {
  const wait = lastLlmAt + MIN_LLM_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastLlmAt = Date.now();
}

function isJapanese(text: string): boolean {
  const t = (text || '').replace(/\s/g, '');
  if (!t) return false;
  const jp = (t.match(/[぀-ヿ㐀-鿿]/g) || []).length;
  return jp / t.length >= 0.2;
}

function extractiveSummary(text: string, min = 100, max = 200): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[。．.!?！？])/).map((s) => s.trim()).filter((s) => s.length >= 12);
  let out = '';
  for (const s of sentences) { if (out.length >= min) break; out += s; if (out.length >= max) break; }
  if (!out) out = clean.slice(0, max);
  if (out.length > max + 20) out = out.slice(0, max) + '…';
  return out;
}

function buildPrompt(title: string, source: string, body: string): string {
  return `次は実在するニュース記事の本文です。本文に書かれた事実だけを使い、必ず日本語で処理してください（英語記事は日本語に翻訳）。
以下のキーを持つJSONのみを出力してください（前後に説明文を付けない）:
{"summary": "100〜200字の日本語要約。本文に無い固有名詞・数値を足さず、推測・誇張をしない", "category": "次から1つだけ: ${CATEGORIES.join(' / ')}", "tags": ["日本語の重要キーワード", "2〜3個", "#は付けない"]}

【タイトル】${title}
【出典】${source}
【本文】
${body.slice(0, 1800)}`;
}

function normalizeParsed(parsed: any): EnrichResult | null {
  if (!parsed || !parsed.summary || !parsed.category) return null;
  const category = (CATEGORIES as readonly string[]).includes(parsed.category) ? parsed.category : 'AI';
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.slice(0, 3).map((t: any) => String(t).replace(/^#/, '')) : [];
  return { summary: String(parsed.summary).slice(0, 240), category, tags, summarySource: 'llm' };
}

/** OpenAI互換API（Groq / OpenAI / OpenRouter 等）で 要約+カテゴリ+タグ を生成 */
async function openaiCompatEnrich(cfg: LlmConfig, title: string, body: string, source: string): Promise<EnrichResult | null> {
  const doRequest = () => withTimeout(fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: 'あなたは日本語のニュース要約アシスタントです。指定されたJSON形式のみで出力します。' },
        { role: 'user', content: buildPrompt(title, source, body) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  }), 20000);
  try {
    await throttleLlm();
    let res = await doRequest();
    if (res.status === 429) {
      // TPM/RPM制限。Retry-Afterぶん待って一度だけ再試行
      const ra = parseFloat(res.headers.get('retry-after') || '');
      const waitMs = Math.min(isNaN(ra) ? 8 : ra, 20) * 1000;
      console.error(`LLM HTTP 429 -> ${Math.round(waitMs / 1000)}s待って再試行`);
      await sleep(waitMs);
      lastLlmAt = Date.now();
      res = await doRequest();
    }
    if (!res.ok) { console.error('LLM HTTP', res.status); return null; }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return normalizeParsed(JSON.parse(text));
  } catch (e) {
    console.error('openaiCompatEnrich failed:', (e as any)?.message);
    return null;
  }
}

/** Gemini で 要約+カテゴリ+タグ を生成 */
async function geminiEnrich(apiKey: string, title: string, body: string, source: string): Promise<EnrichResult | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            category: { type: 'string', enum: CATEGORIES as unknown as string[] },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'category', 'tags'],
        } as any,
      },
    });
    await throttleLlm();
    const r = await withTimeout(model.generateContent(buildPrompt(title, source, body)), 25000);
    return normalizeParsed(JSON.parse(r.response.text()));
  } catch (e) {
    console.error('geminiEnrich failed:', (e as any)?.message);
    return null;
  }
}

/** プロバイダに応じて 要約+単一カテゴリ+タグ を生成（本文の事実のみ・捏造なし） */
export async function enrich(cfg: LlmConfig, title: string, bodyText: string, source: string): Promise<EnrichResult | null> {
  const body = (bodyText && bodyText.length >= 40) ? bodyText : '';
  if (!body) return null;
  if (cfg.provider === 'gemini') return geminiEnrich(cfg.apiKey, title, body, source);
  return openaiCompatEnrich(cfg, title, body, source);
}

/** 抽出要約（LLMを使わない/使えない場合のフォールバック）。日本語以外は公開しない。 */
export async function summarize(bodyText: string, feedDescription: string): Promise<SummaryResult | null> {
  const source = (bodyText && bodyText.length >= 60) ? bodyText : (feedDescription || '');
  if (!source || source.length < 40) return null;
  if (!isJapanese(source)) return null;
  const usingBody = !!(bodyText && bodyText.length >= 60);
  const summary = extractiveSummary(source);
  if (!summary || summary.length < 30) return null;
  return { summary, summarySource: usingBody ? 'extractive' : 'feed_description' };
}
