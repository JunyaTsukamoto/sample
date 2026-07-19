// 記事収集ジョブ本体（GitHub Actions / cron / 手動から実行） (spec §2, §5, §15)
import fs from 'fs';
import path from 'path';
import {
  readDb, writeDb, saveArticles, appendLog, setMeta,
  getPublishedArticles, applyRetention, CollectionLog,
} from '../src/lib/db';
import { runPipeline } from '../src/lib/collector/pipeline';
import { getLlmConfig } from '../src/lib/collector/summarize';
import { manageSources } from '../src/lib/collector/manageSources';
import { nowJstIso, nextRunJst, toJstIso } from '../src/lib/collector/time';
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

  const llm = getLlmConfig(db0.settings.geminiApiKey) || undefined;
  if (llm) console.log(`[collect] LLM provider = ${llm.provider}${llm.model ? ' ('+llm.model+')' : ''}`);
  else console.log('[collect] LLM未設定: 抽出要約で実行');
  let status: CollectionLog['status'] = 'running';

  try {
    const db = readDb();
    const { articles, log, updatedSources } = await runPipeline(db.sources, db.articles, { llm });

    // 情報源の状態を保存
    const dbAfter = readDb();
    dbAfter.sources = updatedSources;
    writeDb(dbAfter);

    if (articles.length > 0) saveArticles(articles);
    applyRetention(3); // 3日を超えた記事を自動整理

    status = log.sourcesFailed === 0 ? 'success'
      : log.sourcesSucceeded === 0 ? 'failed'
      : 'partial_success';

    const finishedAt = nowJstIso();
    const fullLog: CollectionLog = {
      jobId, scheduledAt, startedAt, finishedAt, status, ...log,
    };
    appendLog(fullLog);
    // 自己修復: 連続失敗6回以上のソースを無効化し予備を補充
    const mng = manageSources(6);
    if (mng.retired.length) console.log('[collect] 無効化:', mng.retired.join(' / '));
    if (mng.added.length) console.log('[collect] 補充:', mng.added.join(' / '));
    setMeta({ nextScheduledAt: nextRunJst() });
    writePublicFeed();

    console.log(`[collect] done status=${status} published=${log.articlesPublished} ` +
      `candidates=${log.candidatesFound} dup=${log.duplicatesRemoved} invalid=${log.invalidUrlsRemoved} ` +
      `sources ${log.sourcesSucceeded}/${log.sourcesAttempted}`);

    if (status === 'failed') process.exit(1);
    process.exit(0); // 完了後は確実にプロセス終了（残存接続で居座らせない）
  } catch (e: any) {
    const finishedAt = nowJstIso();
    appendLog({
      jobId, scheduledAt, startedAt, finishedAt, status: 'failed',
      sourcesAttempted: 0, sourcesSucceeded: 0, sourcesFailed: 0,
      candidatesFound: 0, duplicatesRemoved: 0, invalidUrlsRemoved: 0,
      articlesPublished: 0, errors: [{ message: `致命的エラー: ${e?.message || e}` }],
    });
    setMeta({ nextScheduledAt: nextRunJst() });
    console.error('[collect] FAILED:', e);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
