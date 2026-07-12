import Anthropic from "@anthropic-ai/sdk";
import { db, nowIso } from "./db.js";
import { CATEGORIES, CROSS_DOMAIN_KEYWORDS, CATEGORY_KEYWORDS } from "./categories.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const MAX_ARTICLES_PER_RUN = Number(process.env.SUMMARIZE_BATCH_SIZE || 30);

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// 要件定義書 5.2節: 系統別の要約観点をプロンプトに反映する。
function buildPrompt(article) {
  const categoryList = CATEGORIES.map((c) => `${c.id}: ${c.label}`).join("\n");

  const commonRules = `
あなたは記事の要約・分類を行うアシスタントです。
重要な制約:
- 与えられた本文に書かれている内容のみに基づいて要約・分類してください。
- 本文に書かれていない情報を推測して補完しないでください。事実と推測は区別してください。
- 出力は必ず有効なJSON一つだけを返してください。前置きや説明文は不要です。

利用可能なカテゴリID一覧（該当するものを1つ以上、複数可）:
${categoryList}

横断タグ判定: 記事が「防災シミュレーション」「ABM（エージェントベースモデリング）」「GIS（地理情報システム）」のいずれかと技術的に関連する場合のみ cross_domain_tags に "disaster_abm_gis" を含めてください。関連しない場合は空配列にしてください。
`;

  if (article.track_type === "trend") {
    return `${commonRules}

この記事は「動向・トレンド系」（新モデル発表、企業動向、資金調達、規制・倫理など）です。
以下の観点を含む要約を作成してください:
1. 何が発表・発生したか
2. 誰が関わっているか（企業・研究機関・人物）
3. 業界にとっての意味合い・影響
4. 一次情報か伝聞・推測かの見立て（事実と推測を分けて記述）

出力JSON形式:
{
  "summary": "3〜5文程度の日本語要約",
  "categories": ["該当するカテゴリID"],
  "tags": ["自由記述の短いタグ（3〜6個）"],
  "cross_domain_tags": [],
  "practicality_score": null,
  "how_to_points": []
}

記事タイトル: ${article.title}
記事本文（抜粋）:
${article.raw_content || "(本文取得不可。タイトルのみで判断してください)"}
`;
  }

  // practice
  return `${commonRules}

この記事は「実践・模倣系」（ツール活用法、DIY事例、生成AIコンテンツ制作事例など）です。
以下の観点を含む要約を作成してください:
1. 何が実現できるか
2. 具体的な手順・使用ツール（箇条書きで抽出）
3. 必要な前提条件（費用、スキル、環境）
4. 研究室で応用できそうな場面の示唆

practicality_score は 0〜5 の整数で、研究室で実際に試せそうな具体性・再現性の高さを評価してください（5が最も試しやすい）。

出力JSON形式:
{
  "summary": "3〜5文程度の日本語要約",
  "categories": ["該当するカテゴリID"],
  "tags": ["自由記述の短いタグ（3〜6個）"],
  "cross_domain_tags": [],
  "practicality_score": 0,
  "how_to_points": ["手順やポイントを短い箇条書きで3〜6個"]
}

記事タイトル: ${article.title}
記事本文（抜粋）:
${article.raw_content || "(本文取得不可。タイトルのみで判断してください)"}
`;
}

function safeParseJson(text) {
  // モデルがコードフェンス等を付けた場合に備えて緩めに抽出する
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON not found in response");
  return JSON.parse(match[0]);
}

// LLM未設定時のフォールバック（キーワードベースの簡易処理）。
// 要件定義書のハルシネーション対策方針に反しないよう、本文にない情報の創作は行わない。
function fallbackProcess(article) {
  const text = `${article.title} ${article.raw_content || ""}`.toLowerCase();

  const categories = CATEGORIES.filter((c) => c.track === article.track_type)
    .filter((c) =>
      (CATEGORY_KEYWORDS[c.id] || []).some((kw) => text.includes(kw.toLowerCase()))
    )
    .map((c) => c.id);

  const crossDomain = CROSS_DOMAIN_KEYWORDS.some((kw) =>
    text.includes(kw.toLowerCase())
  )
    ? ["disaster_abm_gis"]
    : [];

  const rawSnippet = (article.raw_content || article.title || "").slice(0, 160);

  return {
    summary: `[簡易要約: LLM未設定のため本文冒頭を抜粋] ${rawSnippet}${
      rawSnippet.length >= 160 ? "…" : ""
    }`,
    categories: categories.length > 0 ? categories : [],
    tags: [],
    cross_domain_tags: crossDomain,
    practicality_score: article.track_type === "practice" ? null : null,
    how_to_points: [],
  };
}

/**
 * pending状態の記事を最大 MAX_ARTICLES_PER_RUN 件処理し、要約・分類結果をDBへ反映する。
 * ANTHROPIC_API_KEY が未設定の場合はフォールバック処理を行い、その旨を要約文に明記する。
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
      summary = @summary,
      categories = @categories,
      tags = @tags,
      cross_domain_tags = @cross_domain_tags,
      practicality_score = @practicality_score,
      how_to_points = @how_to_points,
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
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        });
        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        result = safeParseJson(text);
      }

      updateStmt.run({
        id: article.id,
        summary: result.summary ?? "",
        categories: JSON.stringify(result.categories ?? []),
        tags: JSON.stringify(result.tags ?? []),
        cross_domain_tags: JSON.stringify(result.cross_domain_tags ?? []),
        practicality_score:
          typeof result.practicality_score === "number"
            ? result.practicality_score
            : null,
        how_to_points: JSON.stringify(result.how_to_points ?? []),
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
