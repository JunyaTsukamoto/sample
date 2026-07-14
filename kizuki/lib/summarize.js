import Anthropic from "@anthropic-ai/sdk";
import { db, nowIso } from "./db.js";
import { CATEGORIES, fallbackCategorize } from "./categories.js";
import { computeTopicKey } from "./trend.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const MAX_ARTICLES_PER_RUN = Number(process.env.SUMMARIZE_BATCH_SIZE || 30);

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// 要件 4.2: タイトル(1〜2行)、要約(3〜4文、平易な日本語)、ハッシュタグ(2〜3個)を生成する。
function buildPrompt(article) {
  const categoryList = CATEGORIES.map((c) => `${c.id}: ${c.label}`).join("\n");

  return `あなたは社会・AIの「兆し」記事を要約するアシスタントです。
重要な制約:
- 与えられた本文に書かれている内容のみに基づいて要約・分類してください。
- 本文に書かれていない情報を推測して補完しないでください。
- 出力は必ず有効なJSON一つだけを返してください。前置きや説明文は不要です。

利用可能なカテゴリID一覧（該当するものを1つ以上、複数可）:
${categoryList}

以下の観点でJSONを作成してください:
1. title: 記事タイトルを1〜2行の日本語で簡潔に言い換えたもの（元タイトルが既に簡潔ならそのままでよい）
2. summary: 平易な日本語で3〜4文程度の要約
3. tags: 自動抽出したハッシュタグ2〜3個（記号#は付けない）
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

function safeParseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON not found in response");
  return JSON.parse(match[0]);
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
    tags: [],
    categories,
  };
}

/**
 * pending状態の記事を最大 MAX_ARTICLES_PER_RUN 件処理し、要約・分類結果をDBへ反映する。
 * ANTHROPIC_API_KEY が未設定の場合はフォールバック処理を行う。
 */
export async function summarizePending() {
  const client = getClient();
  const usingFallback = !client;

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

  for (const article of pending) {
    try {
      let result;
      if (usingFallback) {
        result = fallbackProcess(article);
      } else {
        const prompt = buildPrompt(article);
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });
        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        result = safeParseJson(text);
      }

      const tags = Array.isArray(result.tags) ? result.tags.slice(0, 3) : [];
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
    }
  }

  return { processed: pending.length, done, failed, usingFallback };
}
