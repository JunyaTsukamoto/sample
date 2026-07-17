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

const CATEGORIES = ['AI', '制度', '社会×データ', '学術', '新事業'] as const;

/** Promiseにタイムアウトを付ける（外部呼び出しのハング防止） */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}


/** テキストが日本語主体か判定 */
function isJapanese(text: string): boolean {
  const t = (text || '').replace(/\s/g, '');
  if (!t) return false;
  const jp = (t.match(/[぀-ヿ㐀-鿿]/g) || []).length;
  return jp / t.length >= 0.2;
}

/** 文単位で切って指定文字数程度に収める抽出要約（短すぎる断片・ナビ様の行は除外） */
function extractiveSummary(text: string, min = 100, max = 200): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean
    .split(/(?<=[。．.!?！？])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12); // 短い断片(メニュー等)を除外
  let out = '';
  for (const s of sentences) {
    if (out.length >= min) break;
    out += s;
    if (out.length >= max) break;
  }
  if (!out) out = clean.slice(0, max);
  if (out.length > max + 20) out = out.slice(0, max) + '…';
  return out;
}

/**
 * LLMで 要約(日本語) + 単一カテゴリ + タグ を一度に生成 (spec §9)。
 * 元記事本文の事実のみを使用。捏造しない。英語記事は日本語に翻訳して要約。
 */
export async function llmEnrich(
  title: string,
  bodyText: string,
  source: string,
  llmKey: string
): Promise<EnrichResult | null> {
  const src = (bodyText && bodyText.length >= 40) ? bodyText : '';
  if (!src) return null;
  try {
    const genAI = new GoogleGenerativeAI(llmKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: '本文の事実に基づく100〜200字の日本語要約。推測・誇張なし。' },
            category: { type: 'string', enum: CATEGORIES as unknown as string[], description: '最も合致するカテゴリを1つだけ' },
            tags: { type: 'array', items: { type: 'string' }, description: '日本語の重要キーワード2〜3個（#なし）' },
          },
          required: ['summary', 'category', 'tags'],
        } as any,
      },
    });
    const prompt = `次は実在するニュース記事の本文です。本文に書かれた事実だけを使い、必ず日本語で処理してください（英語記事は日本語に翻訳）。\n1) 100〜200字の要約（本文に無い固有名詞・数値を足さない、推測や誇張をしない）\n2) 最も合致するカテゴリを次から1つだけ選ぶ: ${CATEGORIES.join(' / ')}\n3) 日本語の重要キーワードを2〜3個\nJSONのみ出力。\n\n【タイトル】${title}\n【出典】${source}\n【本文】\n${src.slice(0, 6000)}`;
    const r = await withTimeout(model.generateContent(prompt), 25000);
    const parsed = JSON.parse(r.response.text());
    if (!parsed?.summary || !parsed?.category) return null;
    const category = (CATEGORIES as readonly string[]).includes(parsed.category) ? parsed.category : 'AI';
    const tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3).map((t: string) => String(t).replace(/^#/, '')) : [];
    return { summary: String(parsed.summary).slice(0, 240), category, tags, summarySource: 'llm' };
  } catch (e) {
    console.error('llmEnrich failed:', (e as any)?.message);
    return null;
  }
}

/**
 * 抽出要約（LLMキーが無い場合のフォールバック）。日本語以外は公開しない。
 */
export async function summarize(
  bodyText: string,
  feedDescription: string,
  _llmKey?: string
): Promise<SummaryResult | null> {
  const source = (bodyText && bodyText.length >= 60) ? bodyText : (feedDescription || '');
  if (!source || source.length < 40) return null;
  if (!isJapanese(source)) return null; // 英語要約の混入防止
  const usingBody = !!(bodyText && bodyText.length >= 60);
  const summary = extractiveSummary(source);
  if (!summary || summary.length < 30) return null;
  return { summary, summarySource: usingBody ? 'extractive' : 'feed_description' };
}
