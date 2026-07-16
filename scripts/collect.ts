// 記事収集ジョブ本体（GitHub Actions / cron / 手動から実行） (spec §2, §5, §15)
import fs from 'fs';
import path from 'path';
import {
  readDb, writeDb, saveArticles, appendLog, setMeta,
  getPublishedArticles, CollectionLog,
} from '../src/lib/db';
import { runPipeline } from '../src/lib/collector/pipeline';
import { nowJstIso, nextSevenAmJst, toJstIso } from '../src/lib/collector/time';
import { seedSources } from './seed';

function jstDateKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10); // YYYY-MM-DD (JST ISO)
}

function writePublicFeed() {
  const articles = getPublishedArticles();
  const meta = readDb().meta;
  const dir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'feed.json'), JSON.stringify({ meta, articles }, null, 2), 'utf-8');
}

async function main() {
  const force = process.argv.includes('--force');
  const scheduledAt = process.env.SCHEDULED_AT || nowJstIso();

  // 情報源が空なら config からシード
  if (readDb().sources.length === 0) seedSources();

  // 同日重複実行の防止 (spec §21.1)
  const db0 = readDb();
  const todayKey = jstDateKey(nowJstIso());
  const lastSuccessKey = jstDateKey(db0.meta.lastSuccessAt);
  if (!force && lastSuccessKey === todayKey) {
    console.log(`[collect] 本日(${todayKey})は既に収集成功済みのためスキップします。--force で強制実行可能。`);
    return;
  }

  const startedAt = nowJstIso();
  const now = new Date();
  const jobId = `collection-${toJstIso(now).slice(0, 10).replace(/-/g, '')}-${toJstIso(now).slice(11, 16).replace(':', '')}`;
  console.log(`[collect] job=${jobId} start=${startedAt}`);

  const llmKey = process.env.GEMINI_API_KEY || db0.settings.geminiApiKey || undefined;
  let status: CollectionLog['status'] = 'running';

  try {
    const db = readDb();
    const { articles, log, updatedSources } = await runPipeline(db.sources, db.articles, { llmKey });

    // 情報源の状態を保存
    const dbAfter = readDb();
    dbAfter.sources = updatedSources;
    writeDb(dbAfter);

    if (articles.length > 0) saveArticles(articles);

    status = log.sourcesFailed === 0 ? 'success'
      : log.sourcesSucceeded === 0 ? 'failed'
      : 'partial_success';

    const finishedAt = nowJstIso();
    const fullLog: CollectionLog = {
      jobId, scheduledAt, startedAt, finishedAt, status, ...log,
    };
    appendLog(fullLog);
    setMeta({ nextScheduledAt: nextSevenAmJst() });
    writePublicFeed();

    console.log(`[collect] done status=${status} published=${log.articlesPublished} ` +
      `candidates=${log.candidatesFound} dup=${log.duplicatesRemoved} invalid=${log.invalidUrlsRemoved} ` +
      `sources ${log.sourcesSucceeded}/${log.sourcesAttempted}`);

    if (status === 'failed') process.exit(1);
  } catch (e: any) {
    const finishedAt = nowJstIso();
    appendLog({
      jobId, scheduledAt, startedAt, finishedAt, status: 'failed',
      sourcesAttempted: 0, sourcesSucceeded: 0, sourcesFailed: 0,
      candidatesFound: 0, duplicatesRemoved: 0, invalidUrlsRemoved: 0,
      articlesPublished: 0, errors: [{ message: `致命的エラー: ${e?.message || e}` }],
    });
    setMeta({ nextScheduledAt: nextSevenAmJst() });
    console.error('[collect] FAILED:', e);
    process.exit(1);
  }
}

main();
