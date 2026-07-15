import Parser from "rss-parser";
import { db, nowIso, runInTransaction } from "./db.js";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "kizuki/0.1 (personal trend curation reader)" },
});

const MAX_AGE_DAYS = Number(process.env.MAX_ARTICLE_AGE_DAYS || 7);
// 1回の収集で新規に取り込む記事数の上限（LLM要約の無料枠を使い切らないための制限）。
const MAX_NEW_ARTICLES_PER_RUN = Number(process.env.MAX_NEW_ARTICLES_PER_RUN || 15);

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 要件 4.1: 選定対象は公開から1週間以内の記事のみ。公開日が取れない場合は
// 収集時点を公開日とみなし、新着として扱う（除外しすぎないための緩和措置）。
function isWithinFreshnessWindow(publishedAt) {
  if (!publishedAt) return true;
  const publishedMs = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedMs)) return true;
  const ageMs = Date.now() - publishedMs;
  return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 全アクティブソースからRSSを収集し、未登録かつ1週間以内の記事をpendingとしてarticlesへ挿入する。
 * 戻り値: { fetched, inserted, skippedOld, sourcesOk, sourcesFailed, errors }
 */
export async function collectAll() {
  const sources = db.prepare("SELECT * FROM sources WHERE is_active = 1").all();

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO articles
      (source_id, title, url, published_at, fetched_at, raw_content, llm_process_status)
    VALUES
      (@source_id, @title, @url, @published_at, @fetched_at, @raw_content, 'pending')
  `);
  const updateSourceStmt = db.prepare(
    "UPDATE sources SET last_fetched_at = @ts, updated_at = @ts WHERE id = @id"
  );

  let fetched = 0;
  let inserted = 0;
  let skippedOld = 0;
  let sourcesOk = 0;
  let sourcesFailed = 0;
  const errors = [];

  for (const source of sources) {
    if (inserted >= MAX_NEW_ARTICLES_PER_RUN) break;

    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items ?? [];
      fetched += items.length;

      runInTransaction(() => {
        for (const item of items) {
          if (inserted >= MAX_NEW_ARTICLES_PER_RUN) break;

          const url = item.link || item.guid;
          if (!url) continue;

          const publishedAt = item.isoDate || item.pubDate || null;
          if (!isWithinFreshnessWindow(publishedAt)) {
            skippedOld += 1;
            continue;
          }

          const title = item.title?.trim() || "(タイトルなし)";
          const rawContent = stripHtml(
            item.contentSnippet || item.content || item.summary || ""
          ).slice(0, 4000);

          const result = insertStmt.run({
            source_id: source.id,
            title,
            url,
            published_at: publishedAt,
            fetched_at: nowIso(),
            raw_content: rawContent,
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

  return { fetched, inserted, skippedOld, sourcesOk, sourcesFailed, errors };
}
