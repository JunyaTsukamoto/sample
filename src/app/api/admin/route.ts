import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, getSources, saveSources, getArticles, getLogs, getMeta } from '@/lib/db';
import { recheckUrl } from '@/lib/collector/validateUrl';
import { nowJstIso } from '@/lib/collector/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = readDb();
  return NextResponse.json({
    sources: db.sources,
    logs: db.logs.slice(0, 30),
    meta: db.meta,
    articles: db.articles
      .slice()
      .sort((a, b) => new Date(b.collectedAt || b.scrapedAt).getTime() - new Date(a.collectedAt || a.scrapedAt).getTime())
      .slice(0, 200)
      .map((a) => ({
        id: a.id, title: a.title, source: a.source, originalUrl: a.originalUrl,
        finalUrl: a.finalUrl || a.url, httpStatus: a.httpStatus, linkStatus: a.linkStatus,
        published: a.published, publishedAt: a.publishedAt, lastVerifiedAt: a.lastVerifiedAt,
        summary: a.summary, summarySource: a.summarySource, categories: a.categories,
      })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;
  const db = readDb();

  if (action === 'toggle-source') {
    const s = db.sources.find((x) => x.id === body.sourceId);
    if (s) { s.enabled = !s.enabled; writeDb(db); }
    return NextResponse.json({ success: true, sources: db.sources });
  }

  if (action === 'unpublish') {
    const a = db.articles.find((x) => x.id === body.articleId);
    if (a) { a.published = false; a.updatedAt = nowJstIso(); writeDb(db); }
    return NextResponse.json({ success: true });
  }

  if (action === 'recheck') {
    const a = db.articles.find((x) => x.id === body.articleId);
    if (!a) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    const r = await recheckUrl(a.finalUrl || a.url);
    a.lastVerifiedAt = nowJstIso(); a.httpStatus = r.httpStatus; a.linkStatus = r.linkStatus;
    a.validationError = r.error;
    if (r.linkStatus === 'broken') a.published = false;
    else if (r.linkStatus !== 'temporarily_unavailable') a.published = true;
    writeDb(db);
    return NextResponse.json({ success: true, linkStatus: r.linkStatus, httpStatus: r.httpStatus });
  }

  return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
}
