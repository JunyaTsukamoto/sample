import { NextRequest, NextResponse } from 'next/server';
import { readDb, getPublishedArticles, Article } from '@/lib/db';
import { isMockEnabled, mockArticles } from '@/lib/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const bookmarksOnly = searchParams.get('bookmarks') === 'true';
    const query = searchParams.get('query')?.toLowerCase().trim() || '';

    const db = readDb();
    // 一般フィードは検証済み・公開記事のみ (spec §8, §13)
    // 本番では isMockEnabled()===false のためモックは決して混入しない (spec §19)
    const articles = isMockEnabled() ? [...getPublishedArticles(), ...mockArticles()] : getPublishedArticles();
    const bookmarks = new Set(db.bookmarks);
    const preferences = db.preferences;
    const mutationRate = db.settings.mutationRate ?? 0.08;

    let filtered = articles;
    if (bookmarksOnly) filtered = filtered.filter((a) => bookmarks.has(a.id));
    if (category && category !== 'すべて') filtered = filtered.filter((a) => a.categories.includes(category));
    if (query) {
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          (a.originalTitle || '').toLowerCase().includes(query) ||
          a.summary.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // APIキーはクライアントに返さない（漏洩防止）
    const safeSettings = { mutationRate: db.settings.mutationRate, geminiApiKey: '' };
    const respond = (arts: Article[]) =>
      NextResponse.json({ articles: arts, preferences, bookmarks: db.bookmarks, settings: safeSettings, meta: db.meta, lastLog: db.logs[0] || null });

    if (filtered.length === 0) return respond([]);

    if (bookmarksOnly) {
      return respond([...filtered].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
    }

    // パーソナライズスコア = trendScore * 嗜好倍率
    const scored = filtered.map((a) => {
      let catScore = 1.0;
      if (a.categories?.length) catScore = Math.max(...a.categories.map((c) => preferences.categories[c] ?? 1.0));
      let tagScore = 1.0;
      if (a.tags?.length) {
        let sum = 0, n = 0;
        a.tags.forEach((t) => { if (preferences.tags[t] !== undefined) { sum += preferences.tags[t]; n++; } });
        if (n > 0) tagScore = sum / n;
      }
      const mult = catScore * 0.7 + tagScore * 0.3;
      return { ...a, totalScore: a.trendScore * mult };
    });
    scored.sort((a, b) => (b as any).totalScore - (a as any).totalScore);

    // フィルターバブル対策の突然変異ミックス
    const finalArticles: Article[] = [];
    const limit = 40;
    const pivot = Math.floor(scored.length * 0.6);
    const top = scored.slice(0, pivot);
    const mut = scored.slice(pivot);
    const maxItems = Math.min(scored.length, limit);
    for (let i = 0; i < maxItems; i++) {
      if (Math.random() < mutationRate && mut.length > 0) {
        const it = mut.splice(Math.floor(Math.random() * mut.length), 1)[0];
        const ti = top.findIndex((t) => t.id === it.id); if (ti !== -1) top.splice(ti, 1);
        const { totalScore, ...clean } = it as any; finalArticles.push(clean);
      } else if (top.length > 0) {
        const it = top.shift()!;
        const mi = mut.findIndex((m) => m.id === it.id); if (mi !== -1) mut.splice(mi, 1);
        const { totalScore, ...clean } = it as any; finalArticles.push(clean);
      } else if (mut.length > 0) {
        const { totalScore, ...clean } = mut.shift()! as any; finalArticles.push(clean);
      }
    }
    return respond(finalArticles);
  } catch (e: any) {
    console.error('news error:', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
