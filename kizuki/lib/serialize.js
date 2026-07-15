function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeArticle(row) {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name ?? null,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    summary: row.summary,
    categories: parseJsonArray(row.categories),
    tags: parseJsonArray(row.tags),
    mentionCount: row.mention_count,
    sourceCount: row.source_count,
    trendScore: row.trend_score,
    bookmarkedAt: row.bookmarked_at,
    isBookmarked: !!row.bookmarked_at,
    isDuplicate: !!row.is_duplicate,
    llmProcessStatus: row.llm_process_status,
    createdAt: row.created_at,
  };
}

export function serializeSource(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    defaultCategory: row.default_category,
    isActive: !!row.is_active,
    lastFetchedAt: row.last_fetched_at,
  };
}
