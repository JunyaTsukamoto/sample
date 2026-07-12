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
    howToPoints: parseJsonArray(row.how_to_points),
    trackType: row.track_type,
    categories: parseJsonArray(row.categories),
    tags: parseJsonArray(row.tags),
    crossDomainTags: parseJsonArray(row.cross_domain_tags),
    practicalityScore: row.practicality_score,
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
    trackType: row.track_type,
    fetchMethod: row.fetch_method,
    isActive: !!row.is_active,
    lastFetchedAt: row.last_fetched_at,
  };
}
