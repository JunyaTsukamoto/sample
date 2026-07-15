import Anthropic from "@anthropic-ai/sdk";
import { db, nowIso } from "./db.js";
import { CATEGORIES, fallbackCategorize, fallbackTags } from "./categories.js";
import { computeTopicKey } from "./trend.js";

// 要件 8章 未確定事項#2「使用LLM」の回答: Claude APIを優先しつつ、
// 無料で使えるGoogle Gemini API(無料枠あり)をデフォルトのフォールバック手段として追加した。
// 優先順位: ANTHROPIC_API_KEY > GEMINI_API_KEY > キーワードベースの簡易処理。
// LLM_PROVIDER=anthropic|gemini|none で明示的に固定することもできる。
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
// 無料枠での動作を確認済みの "gemini-flash-lite-latest" をデフォルトに採用。
// 固定バージョン(gemini-2.0-flash等)は無料枠の割り当てが0のプロジェクトがあるため、
// ローリングエイリアス(latest系)の方が無料枠での動作実績が高い。
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const MAX_ARTICLES_PER_RUN = Number(process.env.SUMMARIZE_BATCH_SIZE || 30);
// Gemini無料枠は1分あたりのリクエスト数に厳しい上限があるため、記事間に間隔を空けて
// バーストで叩かないようにする（大量のpending記事が一斉に429で失敗する問題への対策）。
const GEMINI_MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS || 4200);
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 3);

function resolveProvider() {
  const forced = process.env.LLM_PROVIDER;
  if (forced === "anthropic" || forced === "gemini" || forced === "none") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 要件 4.2: タイトル(1〜2行)、要約(3〜4文、平易な日本語)、ハッシュタグ(2〜3個)を生成する。
function buildPrompt(article) {
  const categoryList = CATEGORIES.map((c) => `${c.id}: ${c.label}`).join("\n");

  return `あなたは社会・AIの「兆し」記事を要約するアシスタントです。
重要な制約:
- 与えられた本文に書かれている内容のみに基づいて要約・分類してください。
- 本文に書かれていない情報を推測して補完しないでください。
- 出力は必ず有効なJSON一つだけを返してください。前置きや説明文は不要です。マークダウンのコードフェンスも付けないでください。

利用可能なカテゴリID一覧（該当するものを1つ以上、複数可）:
${categoryList}

以下の観点でJSONを作成してください:
1. title: 記事タイトルを1〜2行の日本語で簡潔に言い換えたもの（元タイトルが既に簡潔ならそのままでよい）
2. summary: 平易な日本語で3〜4文程度の要約
3. tags: この記事の内容に合ったハッシュタグを2〜3個、本文から自動抽出する（記号#は付けない。汎用的すぎる単語は避け、固有名詞やトピックを優先する）
4. categories: 該当するカテゴリID（複数可）

出力JSON形式:
{
  "title": "...",
  "summary": "...",
  "tags": ["...", "..."],
  "categories": ["ai"]
}

記事タイトル: ${article.title}
記事本文（抜粋）:
${article.raw_content || "(本文取得不可。タイトルのみで判断してください)"}
`;
}

// LLMがコードフェンス(```json ... ```)を付けて返す場合や前置き文が混じる場合に備えて
// 最初の "{" から最後の "}" までを抽出してからパースする。
function safeParseJson(text) {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSON not found in response");
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

class RetryableError extends Error {}

async function callWithRetry(fn, { retries = MAX_RETRIES } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!(err instanceof RetryableError) || attempt === retries) break;
      const backoffMs = err.retryAfterMs ?? 1500 * 2 ** attempt;
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

async function callAnthropic(prompt) {
  return callWithRetry(async () => {
    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    } catch (err) {
      // Anthropic SDKは429/529等でstatusを持つエラーを投げる
      if (err.status === 429 || err.status === 529 || err.status === 503) {
        const retryable = new RetryableError(err.message);
        retryable.retryAfterMs = null;
        throw retryable;
      }
      throw err;
    }
  });
}

// Google AI Studio の無料枠(gemini-flash-lite-latest等)を使った要約。
// 料金・登録: https://aistudio.google.com/apikey でAPIキーを無料発行できる（クレジットカード不要）。
async function callGemini(prompt) {
  return callWithRetry(async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429 || res.status === 503) {
        const retryable = new RetryableError(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
        // レスポンス内の "retryDelay": "39s" 形式のヒントを尊重する
        const match = errText.match(/"retryDelay":\s*"(\d+)s"/);
        retryable.retryAfterMs = match ? (Number(match[1]) + 1) * 1000 : null;
        throw retryable;
      }
      throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n");
    if (!text) throw new Error("Gemini response contained no text");
    return text;
  });
}

// LLM未設定時のフォールバック（キーワードベースの簡易処理）。
function fallbackProcess(article) {
  const text = `${article.title} ${article.raw_content || ""}`;
  const categories = fallbackCategorize(text);
  const rawSnippet = (article.raw_content || article.title || "").slice(0, 160);

  return {
    title: article.title,
    summary: `[簡易要約: LLM未設定のため本文冒頭を抜粋] ${rawSnippet}${
      rawSnippet.length >= 160 ? "…" : ""
    }`,
    tags: fallbackTags(text),
    categories,
  };
}

/**
 * pending状態の記事を最大 MAX_ARTICLES_PER_RUN 件処理し、要約・分類結果をDBへ反映する。
 * 使用するLLMは resolveProvider() の優先順位に従って自動選択される。
 * Gemini利用時は無料枠のレート制限に配慮し、記事間に間隔を空けて呼び出す。
 */
export async function summarizePending() {
  const provider = resolveProvider();

  const pending = db
    .prepare(
      `SELECT * FROM articles WHERE llm_process_status = 'pending' ORDER BY published_at DESC LIMIT ?`
    )
    .all(MAX_ARTICLES_PER_RUN);

  const updateStmt = db.prepare(`
    UPDATE articles SET
      title = @title,
      summary = @summary,
      categories = @categories,
      tags = @tags,
      topic_key = @topic_key,
      llm_process_status = @status,
      updated_at = @updated_at
    WHERE id = @id
  `);

  let done = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < pending.length; i += 1) {
    const article = pending[i];
    try {
      let result;
      if (provider === "none") {
        result = fallbackProcess(article);
      } else {
        const prompt = buildPrompt(article);
        const text =
          provider === "anthropic" ? await callAnthropic(prompt) : await callGemini(prompt);
        result = safeParseJson(text);
      }

      const tags = Array.isArray(result.tags) && result.tags.length > 0
        ? result.tags.slice(0, 3)
        : fallbackTags(`${article.title} ${article.raw_content || ""}`);
      const categories = Array.isArray(result.categories) && result.categories.length > 0
        ? result.categories
        : fallbackCategorize(`${article.title} ${article.raw_content || ""}`);

      updateStmt.run({
        id: article.id,
        title: result.title?.trim() || article.title,
        summary: result.summary ?? "",
        categories: JSON.stringify(categories),
        tags: JSON.stringify(tags),
        topic_key: computeTopicKey({ tags, categories, title: article.title }),
        status: "done",
        updated_at: nowIso(),
      });
      done += 1;
    } catch (err) {
      db.prepare(
        `UPDATE articles SET llm_process_status = 'failed', updated_at = @ts WHERE id = @id`
      ).run({ ts: nowIso(), id: article.id });
      failed += 1;
      errors.push(`article#${article.id}: ${String(err.message || err).slice(0, 200)}`);
    }

    // Gemini無料枠のRPM制限を超えないよう、次の記事まで間隔を空ける（最後の記事の後は不要）。
    if (provider === "gemini" && i < pending.length - 1) {
      await sleep(GEMINI_MIN_INTERVAL_MS);
    }
  }

  return { processed: pending.length, done, failed, provider, errors };
}
