import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  readDb, writeDb, saveArticles, appendLog, setMeta, getPublishedArticles, applyRetention, CollectionLog,
} from '@/lib/db';
import { runPipeline } from '@/lib/collector/pipeline';
import { getLlmConfig } from '@/lib/collector/summarize';
import { nowJstIso, nextRunJst, toJstIso } from '@/lib/collector/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function writePublicFeed() {
  const articles = getPublishedArticles();
  const meta = readDb().meta;
  const dir = path.join(process.cwd(), 'public', 'data');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'feed.json'), JSON.stringify({ meta, articles }, null, 2)); } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get('authorization') || '';
      if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const db = readDb();
    if (db.sources.length === 0) {
      // config からシード
      const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'sources.json'), 'utf-8'));
      db.sources = cfg; writeDb(db);
    }
    const llm = getLlmConfig(db.settings.geminiApiKey) || undefined;
    const startedAt = nowJstIso();
    const jobId = `manual-${toJstIso(new Date()).replace(/[-:]/g, '').slice(0, 13)}`;

    const { articles, log, updatedSources } = await runPipeline(db.sources, db.articles, { llm });
    const after = readDb(); after.sources = updatedSources; writeDb(after);
    if (articles.length > 0) saveArticles(articles);
    applyRetention(3);

    const status: CollectionLog['status'] =
      log.sourcesFailed === 0 ? 'success' : log.sourcesSucceeded === 0 ? 'failed' : 'partial_success';
    const finishedAt = nowJstIso();
    appendLog({ jobId, scheduledAt: startedAt, startedAt, finishedAt, status, ...log });
    setMeta({ nextScheduledAt: nextRunJst() });
    writePublicFeed();

    return NextResponse.json({
      success: status !== 'failed',
      message: `収集完了: 公開${log.articlesPublished}件 / 候補${log.candidatesFound} / 重複除外${log.duplicatesRemoved} / 無効URL${log.invalidUrlsRemoved} / 情報源 ${log.sourcesSucceeded}/${log.sourcesAttempted}`,
      count: log.articlesPublished, total: getPublishedArticles().length,
      status, timestamp: finishedAt,
    });
  } catch (e: any) {
    console.error('fetch error:', e);
    return NextResponse.json({ success: false, error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
