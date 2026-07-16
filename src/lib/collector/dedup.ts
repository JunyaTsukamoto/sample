import { normalizeUrl, tokenize, jaccard } from './normalize';

export interface DedupKeyed {
  finalUrl?: string;
  url: string;
  originalUrl?: string;
  canonicalUrl?: string | null;
  title: string;
  contentHash?: string;
}

/**
 * 重複排除 (spec §11)。
 * 正規化URL / canonical / リダイレクト後URL / タイトル / 本文ハッシュ / タイトル類似度。
 * 既存記事集合と新規候補の双方に対して判定する。
 */
export function isDuplicate<T extends DedupKeyed>(
  candidate: T,
  seenUrls: Set<string>,
  seenHashes: Set<string>,
  seenTitleTokens: { tokens: Set<string> }[],
  simThreshold = 0.85
): boolean {
  const urls = [candidate.finalUrl, candidate.url, candidate.originalUrl, candidate.canonicalUrl]
    .filter(Boolean)
    .map((u) => normalizeUrl(u as string));
  if (urls.some((u) => seenUrls.has(u))) return true;
  if (candidate.contentHash && seenHashes.has(candidate.contentHash)) return true;
  const toks = tokenize(candidate.title);
  for (const s of seenTitleTokens) {
    if (jaccard(toks, s.tokens) >= simThreshold) return true;
  }
  return false;
}

export function registerSeen<T extends DedupKeyed>(
  item: T,
  seenUrls: Set<string>,
  seenHashes: Set<string>,
  seenTitleTokens: { tokens: Set<string> }[]
): void {
  [item.finalUrl, item.url, item.originalUrl, item.canonicalUrl]
    .filter(Boolean)
    .forEach((u) => seenUrls.add(normalizeUrl(u as string)));
  if (item.contentHash) seenHashes.add(item.contentHash);
  seenTitleTokens.push({ tokens: tokenize(item.title) });
}
