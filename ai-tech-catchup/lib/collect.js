import Parser from "rss-parser";
import { db, nowIso, runInTransaction } from "./db.js";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ai-tech-catchup/0.1 (personal RSS reader)" },
});

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 全アクティブソースからRSSを収集し、未登録の記事をpendingとしてarticlesテーブルへ挿入する。
 * 戻り値: { fetched, inserted, sourcesOk, sourcesFailed, errors }
 */
export async function collectAll() {
  const sources = db
    .prepare("SELECT * FROM sources WHERE is_active = 1")
    .all();

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO articles
      (source_id, title, url, published_at, fetched_at, raw_content, track_type, llm_process_status)
    VALUES
      (@source_id, @title, @url, @published_at, @fetched_at, @raw_content, @track_type, 'pending')
  `);
  const updateSourceStmt = db.prepare(
    "UPDATE sources SET last_fetched_at = @ts, updated_at = @ts WHERE id = @id"
  );

  let fetched = 0;
  let inserted = 0;
  let sourcesOk = 0;
  let sourcesFailed = 0;
  const errors = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items ?? [];
      fetched += items.length;

      runInTransaction(() => {
        for (const item of items) {
          const url = item.link || item.guid;
          if (!url) continue;
          const title = item.title?.trim() || "(タイトルなし)";
          const rawContent = stripHtml(
            item.contentSnippet || item.content || item.summary || ""
          ).slice(0, 4000);
          const publishedAt = item.isoDate || item.pubDate || null;

          const result = insertStmt.run({
            source_id: source.id,
            title,
            url,
            published_at: publishedAt,
            fetched_at: nowIso(),
            raw_content: rawContent,
            track_type: source.track_type,
          });
          if (result.changes > 0) inserted += 1;
        }
      });

      updateSourceStmt.run({ ts: nowIso(), id: source.id });
      sourcesOk += 1;
    } catch (err) {
      sourcesFailed += 1;
      errors.push(`${source.name}: ${err.message}`);
    }
  }

  return { fetched, inserted, sourcesOk, sourcesFailed, errors };
}
