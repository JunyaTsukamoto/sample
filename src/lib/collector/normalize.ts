import crypto from 'crypto';

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'yclid', '_hsenc', '_hsmi',
];

/** 相対URLを絶対URLに変換 (spec §5-5) */
export function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** URLを正規化: トラッキング除去 / フラグメント除去 / ホスト小文字化 (spec §5-6, §11) */
export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    // 末尾スラッシュの正規化（ルート以外）
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    // クエリのキー順を安定化
    u.searchParams.sort();
    return u.toString();
  } catch {
    return input;
  }
}

/** URLスキームが http/https かつ形式が妥当か (spec §6.1) */
export function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 危険/不正スキームの拒否 (spec §21.2 javascript: 等) */
export function isDangerousScheme(input: string): boolean {
  return /^\s*(javascript|data|vbscript|file|mailto|tel):/i.test(input);
}

/** 本文ハッシュ (spec §8 contentHash, §11 本文ハッシュ) */
export function contentHash(title: string, body: string): string {
  const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha256').update(norm(title) + '\n' + norm(body)).digest('hex');
}

/** タイトルのトークン集合（類似度用） */
export function tokenize(text: string): Set<string> {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/[【】\[\]（）()「」、。,.:;!?・…\-—|\/]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  return new Set(tokens);
}

/** Jaccard類似度 (spec §11 要約/タイトルの類似度) */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter);
}
