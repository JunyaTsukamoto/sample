import { db, nowIso } from "./db.js";

// 要件 4.4: フィードバックのたびにEMA（指数移動平均）で好みスコアを段階的に更新する。
// score は -1.0〜+1.0 の範囲。ALPHA が学習率（大きいほど直近のフィードバックを重視）。
export const PREFERENCE_ALPHA = Number(process.env.PREFERENCE_ALPHA || 0.2);

export function preferenceKeyForCategory(categoryId) {
  return `category:${categoryId}`;
}

export function preferenceKeyForTag(tag) {
  return `tag:${tag}`;
}

export function getPreferenceScore(key) {
  const row = db.prepare("SELECT score FROM preferences WHERE key = ?").get(key);
  return row ? row.score : 0;
}

export function getAllPreferences() {
  const rows = db.prepare("SELECT key, score FROM preferences").all();
  const map = new Map();
  for (const row of rows) map.set(row.key, row.score);
  return map;
}

function upsertPreference(key, newScore) {
  db.prepare(
    `INSERT INTO preferences (key, score, updated_at) VALUES (@key, @score, @ts)
     ON CONFLICT(key) DO UPDATE SET score = @score, updated_at = @ts`
  ).run({ key, score: newScore, ts: nowIso() });
}

// feedbackValue: +1 (もっと見たい) / -1 (あまり興味ない)
export function applyEmaFeedback(key, feedbackValue) {
  const current = getPreferenceScore(key);
  const updated = current * (1 - PREFERENCE_ALPHA) + feedbackValue * PREFERENCE_ALPHA;
  const clamped = Math.max(-1, Math.min(1, updated));
  upsertPreference(key, clamped);
  return clamped;
}

// 記事のカテゴリ・タグすべてに対してEMA更新を行う
export function recordFeedback(article, feedbackValue) {
  db.prepare(
    "INSERT INTO feedback_log (article_id, value, created_at) VALUES (?, ?, ?)"
  ).run(article.id, feedbackValue, nowIso());

  const updatedKeys = [];
  for (const category of article.categories) {
    const key = preferenceKeyForCategory(category);
    updatedKeys.push({ key, score: applyEmaFeedback(key, feedbackValue) });
  }
  for (const tag of article.tags) {
    const key = preferenceKeyForTag(tag);
    updatedKeys.push({ key, score: applyEmaFeedback(key, feedbackValue) });
  }
  return updatedKeys;
}

// ある記事の平均好みスコア（カテゴリ・タグの好みスコアの平均）
export function averagePreferenceForArticle(article, preferenceMap) {
  const keys = [
    ...article.categories.map(preferenceKeyForCategory),
    ...article.tags.map(preferenceKeyForTag),
  ];
  if (keys.length === 0) return 0;
  const scores = keys.map((k) => preferenceMap.get(k) ?? 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
