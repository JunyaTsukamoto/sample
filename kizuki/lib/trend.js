import { db, nowIso } from "./db.js";

// 要件 4.3: トレンド・注目度スコアリング。
// trend_score = w1*言及頻度 + w2*複数媒体掲載 + w3*鮮度 (+ w4*SNS言及, v1では未実装のため0固定)
const W1 = Number(process.env.TREND_WEIGHT_MENTION ?? 0.4);
const W2 = Number(process.env.TREND_WEIGHT_SOURCE ?? 0.3);
const W3 = Number(process.env.TREND_WEIGHT_FRESHNESS ?? 0.3);
const W4 = Number(process.env.TREND_WEIGHT_SNS ?? 0);

const MENTION_SATURATION = Number(process.env.TREND_MENTION_SATURATION || 5);
const SOURCE_SATURATION = Number(process.env.TREND_SOURCE_SATURATION || 3);
const FRESHNESS_HALFLIFE_HOURS = Number(process.env.TREND_FRESHNESS_HALFLIFE_HOURS || 36);

function freshnessScore(publishedAt) {
  if (!publishedAt) return 0.5;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return 0.5;
  const ageHours = ageMs / (1000 * 60 * 60);
  // 指数減衰: 半減期ごとにスコアが半分になる
  return Math.pow(0.5, ageHours / FRESHNESS_HALFLIFE_HOURS);
}

// 記事のタイトル・タグから同一トピックを緩く束ねるための正規化キーを作る。
// v1では厳密なクラスタリングは行わず、タグの先頭2件（あれば）を基準にする簡易実装。
export function computeTopicKey({ tags, categories, title }) {
  const normalizedTags = (tags || [])
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean)
    .sort();
  if (normalizedTags.length > 0) {
    return `tag:${normalizedTags.slice(0, 2).join("+")}`;
  }
  const category = (categories || [])[0] || "ai";
  // タグが取れなかった場合はタイトル冒頭語でゆるく束ねる
  const titleKey = (title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 12);
  return `cat:${category}:${titleKey}`;
}

/**
 * 直近記事の trend_score / mention_count / source_count を再計算する。
 * 要約が完了した記事のみを対象とする。
 */
export function recomputeTrendScores() {
  const rows = db
    .prepare(
      `SELECT id, source_id, published_at, topic_key
       FROM articles
       WHERE llm_process_status = 'done' AND is_duplicate = 0`
    )
    .all();

  const byTopic = new Map();
  for (const row of rows) {
    const key = row.topic_key || `article:${row.id}`;
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(row);
  }

  const updateStmt = db.prepare(`
    UPDATE articles SET
      mention_count = @mention_count,
      source_count = @source_count,
      trend_score = @trend_score,
      updated_at = @updated_at
    WHERE id = @id
  `);

  let updated = 0;
  for (const group of byTopic.values()) {
    const mentionCount = group.length;
    const sourceCount = new Set(group.map((r) => r.source_id)).size;

    const mentionScore = Math.min(mentionCount / MENTION_SATURATION, 1);
    const sourceScore = Math.min(sourceCount / SOURCE_SATURATION, 1);

    for (const row of group) {
      const trendScore =
        W1 * mentionScore + W2 * sourceScore + W3 * freshnessScore(row.published_at) + W4 * 0;

      updateStmt.run({
        id: row.id,
        mention_count: mentionCount,
        source_count: sourceCount,
        trend_score: trendScore,
        updated_at: nowIso(),
      });
      updated += 1;
    }
  }

  return { updated, topics: byTopic.size };
}
