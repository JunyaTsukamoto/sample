import { Article } from './db';
import { nowJstIso } from './collector/time';

/** 開発環境専用のサンプル記事 (spec §19)。本番では読み込まれない。 */
export const MOCK_LABEL = '開発用サンプル';

export function isMockEnabled(): boolean {
  const useMock = String(process.env.USE_MOCK_DATA || 'false').toLowerCase() === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  return useMock && !isProd;
}

export function mockArticles(): Article[] {
  const now = nowJstIso();
  const mk = (i: number, cat: string, title: string): Article => ({
    id: `mock-${i}`,
    title: `【${MOCK_LABEL}】${title}`,
    originalTitle: title,
    summary: `【${MOCK_LABEL}】これは開発用のダミー要約です。本番環境では表示されません。`,
    summarySource: 'extractive',
    source: MOCK_LABEL,
    sourceId: 'mock',
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    originalUrl: 'https://example.com/',
    publishedAt: now, collectedAt: now, scrapedAt: now, lastVerifiedAt: now,
    httpStatus: 200, contentType: 'text/html', linkStatus: 'unverified',
    validationError: null, categories: [cat], tags: [MOCK_LABEL],
    thumbnailUrl: null, published: true, reliabilityScore: 0.1,
    contentHash: `mock-${i}`, trendScore: 1, createdAt: now, updatedAt: now,
  });
  return [
    mk(1, 'AI', 'サンプルAI記事'),
    mk(2, '制度', 'サンプル制度記事'),
    mk(3, '新事業', 'サンプル新事業記事'),
  ];
}
