import Parser from 'rss-parser';
import { Source } from '../db';
import { absolutize } from './normalize';

export interface FeedItem {
  title: string;
  link: string;              // 生URL（未検証）
  feedDescription: string;   // フィード提供の概要（公式description）
  publishedAt: string | null;
  bookmarkCount?: number;
}

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KizukiBot/2.0) rss-parser' },
  customFields: { item: [['hatena:bookmarkcount', 'bookmarkCount'], ['description', 'descriptionRaw']] },
});

/**
 * 情報源からフィードを取得して候補アイテムを返す (spec §5-2..4)。
 * rss / atom は rss-parser、api は NEWS_API 等の拡張ポイント、manual は空。
 */
export async function fetchFeed(source: Source): Promise<FeedItem[]> {
  if (source.type === 'manual') return [];

  if (source.type === 'api') {
    // 認証が必要なAPIはキーが無ければ空（架空レスポンスで代替しない: spec §18）
    if (!process.env.NEWS_API_KEY) return [];
    // ここに公式APIの実装を追加する（例: NewsAPI）。既定では未対応として空を返す。
    return [];
  }

  // rss / atom / html(フォールバックでRSS解析を試行)
  const feed = await parser.parseURL(encodeURI(source.feedUrl));
  const items: FeedItem[] = [];
  for (const it of feed.items) {
    const rawLink = (it.link || (it as any).guid || '').trim();
    if (!rawLink || !it.title) continue;
    const link = absolutize(rawLink, source.baseUrl);
    const pubStr = it.isoDate || it.pubDate || (it as any).date || null;
    const desc = (it.contentSnippet || (it as any).descriptionRaw || it.content || '')
      .toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let bc: number | undefined;
    if ((it as any).bookmarkCount) {
      const n = parseInt((it as any).bookmarkCount, 10);
      if (!isNaN(n)) bc = n;
    }
    items.push({
      title: it.title.trim(),
      link,
      feedDescription: desc,
      publishedAt: pubStr ? new Date(pubStr).toISOString() : null,
      bookmarkCount: bc,
    });
  }
  return items;
}
