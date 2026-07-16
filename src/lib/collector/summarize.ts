import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SummaryResult {
  summary: string;
  summarySource: 'llm' | 'extractive' | 'feed_description';
}

/** 文単位で切って指定文字数程度に収める抽出要約 */
function extractiveSummary(text: string, min = 100, max = 200): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[。．.!?！？])/).map((s) => s.trim()).filter(Boolean);
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


/** テキストが日本語主体か判定（ひらがな/カタカナ/漢字の割合） */
function isJapanese(text: string): boolean {
  const t = (text || '').replace(/\s/g, '');
  if (!t) return false;
  const jp = (t.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  return jp / t.length >= 0.2;
}

/**
 * 要約生成 (spec §9)。
 * - 元記事本文または公式概要のみを入力とする。捏造しない。
 * - LLMキーがあれば本文を要約、無ければ抽出要約。
 * - 本文も概要も無ければ null（要約を生成しない）。
 */
export async function summarize(
  bodyText: string,
  feedDescription: string,
  llmKey: string | undefined
): Promise<SummaryResult | null> {
  const source = (bodyText && bodyText.length >= 60) ? bodyText : (feedDescription || '');
  if (!source || source.length < 40) return null; // 元記事を取得できない場合は生成しない

  const usingBody = bodyText && bodyText.length >= 60;

  if (llmKey) {
    try {
      const genAI = new GoogleGenerativeAI(llmKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `以下は実在するニュース記事の本文（または公式概要）です。この本文に書かれている事実だけを使って、**必ず日本語で**100〜200文字程度の要約を1つ作成してください。英語など日本語以外の記事は日本語に翻訳して要約してください。本文に無い人物名・数値・制度名を追加せず、推測や誇張を避け、事実のみを簡潔にまとめてください。要約文（日本語）のみを出力してください。\n\n---\n${source.slice(0, 6000)}\n---`;
      const r = await model.generateContent(prompt);
      const text = (r.response.text() || '').replace(/\s+/g, ' ').trim();
      if (text && text.length >= 40) return { summary: text.slice(0, 240), summarySource: 'llm' };
    } catch (e) {
      console.error('LLM summary failed, falling back to extractive:', (e as any)?.message);
    }
  }

  // LLMキーが無い場合、日本語以外の本文は日本語要約を作れないため公開しない（英語要約の混入防止）
  if (!isJapanese(source)) return null;
  const summary = extractiveSummary(source);
  if (!summary || summary.length < 30) return null;
  return { summary, summarySource: usingBody ? 'extractive' : 'feed_description' };
}
