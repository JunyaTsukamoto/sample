import { db } from "./db.js";
import { serializeArticle } from "./serialize.js";
import { getAllPreferences, averagePreferenceForArticle } from "./preferences.js";

// 要件 4.4 / 4.5: 好みスコアによる重み付け表示と、GA的突然変異による多様性確保。
export const PREFERENCE_BETA = Number(process.env.PREFERENCE_BETA || 0.5);
export const MUTATION_RATE = Number(process.env.MUTATION_RATE || 0.07);
// 突然変異候補は「好みスコアが低い（下位割合）」記事から選ぶ。
const MUTATION_LOW_PREFERENCE_PERCENTILE = Number(
  process.env.MUTATION_LOW_PREFERENCE_PERCENTILE || 0.2
);

function fetchCandidates(categoryId) {
  let sql = `
    SELECT articles.*, sources.name AS source_name
    FROM articles
    LEFT JOIN sources ON sources.id = articles.source_id
    WHERE articles.is_duplicate = 0 AND articles.llm_process_status = 'done'
  `;
  const params = [];
  if (categoryId) {
    sql += " AND articles.categories LIKE ?";
    params.push(`%"${categoryId}"%`);
  }
  sql += " ORDER BY COALESCE(articles.published_at, articles.fetched_at) DESC LIMIT 500";
  return db.prepare(sql).all(...params);
}

// 乱数はシード無しの Math.random を使う（個人利用のバッチ/リクエスト単位で十分）。
function pickMutationCandidate(scored, excludedIds) {
  const pool = scored.filter((s) => !excludedIds.has(s.article.id));
  if (pool.length === 0) return null;

  const sortedByPref = [...pool].sort((a, b) => a.avgPref - b.avgPref);
  const lowCount = Math.max(1, Math.floor(pool.length * MUTATION_LOW_PREFERENCE_PERCENTILE));
  const lowPrefPool = sortedByPref.slice(0, lowCount);

  // 低好みスコア候補の中でも、なるべく注目度(trendScore)が高いものを選ぶ
  lowPrefPool.sort((a, b) => b.article.trendScore - a.article.trendScore);
  return lowPrefPool[0] ?? null;
}

/**
 * カテゴリ別の兆しフィードを構築する。
 * displayScore = trendScore * (1 + PREFERENCE_BETA * 平均好みスコア)
 * 一定確率 (MUTATION_RATE) で、好みスコアが低いジャンル/タグの記事を上位に混入させる（多様性確保）。
 */
export function buildFeed({ categoryId = null, limit = 100 } = {}) {
  const rows = fetchCandidates(categoryId);
  const preferenceMap = getAllPreferences();

  const scored = rows.map((row) => {
    const article = serializeArticle(row);
    const avgPref = averagePreferenceForArticle(article, preferenceMap);
    const displayScore = article.trendScore * (1 + PREFERENCE_BETA * avgPref);
    return { article, avgPref, displayScore };
  });

  scored.sort((a, b) => b.displayScore - a.displayScore);

  let ranked = scored.map((s) => s.article);
  const mutationTriggered = Math.random() < MUTATION_RATE;
  let mutatedArticleId = null;

  if (mutationTriggered && scored.length > 1) {
    const topIds = new Set(scored.slice(0, 5).map((s) => s.article.id));
    const mutationPick = pickMutationCandidate(scored, topIds);
    if (mutationPick) {
      mutatedArticleId = mutationPick.article.id;
      const withoutPick = ranked.filter((a) => a.id !== mutatedArticleId);
      const insertAt = Math.min(2, withoutPick.length);
      withoutPick.splice(insertAt, 0, {
        ...mutationPick.article,
        isSerendipity: true,
      });
      ranked = withoutPick;
    }
  }

  return {
    articles: ranked.slice(0, limit),
    mutationTriggered: mutationTriggered && mutatedArticleId !== null,
    mutationRate: MUTATION_RATE,
  };
}
