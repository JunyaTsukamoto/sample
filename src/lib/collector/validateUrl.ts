import { LinkStatus } from '../db';
import { isValidHttpUrl, isDangerousScheme, normalizeUrl } from './normalize';

const UA =
  'Mozilla/5.0 (compatible; KizukiBot/2.0; +https://github.com/your/kizuki) news-curation';

export interface ValidationResult {
  ok: boolean;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  linkStatus: LinkStatus;
  validationError: string | null;
  title: string;
  description: string;
  bodyText: string;
  publishedAt: string | null;
  canonicalUrl: string | null;
  redirected: boolean;
}

function fail(url: string, status: number, linkStatus: LinkStatus, err: string): ValidationResult {
  return {
    ok: false, finalUrl: url, httpStatus: status, contentType: '',
    linkStatus, validationError: err, title: '', description: '',
    bodyText: '', publishedAt: null, canonicalUrl: null, redirected: false,
  };
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** metaタグ抽出（属性順に依存しない） */
function meta(html: string, key: string, attr: 'property' | 'name' = 'property'): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, 'i'),
  ];
  for (const p of patterns) { const v = pick(html, p); if (v) return decodeEntities(v); }
  return null;
}

/** JSON-LD から datePublished を探す */
function jsonLdDate(html: string): string | null {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const s of scripts) {
    const body = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    const m = body.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

/** <article>/<main>/<body> から本文テキストを抽出 */
function extractBody(html: string): string {
  let region =
    pick(html, /<article[^>]*>([\s\S]*?)<\/article>/i) ||
    pick(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ||
    pick(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ||
    html;
  region = region
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(region).replace(/\s+/g, ' ').trim();
}

function looksLikeErrorPage(title: string, body: string): boolean {
  const hay = (title + ' ' + body.slice(0, 400)).toLowerCase();
  return /(404|410|not found|page not found|ページが見つかりません|お探しのページ|見つかりませんでした|エラーが発生|access denied|forbidden)/.test(hay);
}

function looksLikeSearchPage(u: URL): boolean {
  if (/\/(search|検索|find)\b/i.test(u.pathname)) return true;
  for (const k of ['q', 'query', 's', 'keyword', 'search']) {
    if (u.searchParams.has(k)) return true;
  }
  return false;
}

function looksLikeLoginPage(u: URL, title: string): boolean {
  if (/\/(login|signin|sign-in|auth|account\/login)\b/i.test(u.pathname)) return true;
  return /(ログイン|sign in|log in)/i.test(title) && title.length < 30;
}

function isTopPage(u: URL, baseUrl: string): boolean {
  const path = u.pathname.replace(/\/+$/, '');
  if (path === '' && !u.search) return true;
  try {
    const base = new URL(baseUrl);
    const basePath = base.pathname.replace(/\/+$/, '');
    if (u.hostname === base.hostname && path === basePath && !u.search) return true;
  } catch { /* noop */ }
  return false;
}

const MIN_TITLE = 5;
const MIN_BODY = 60;

/**
 * 元記事URLへ実際にアクセスして検証する (spec §6)。
 * リダイレクト追跡・ステータス確認・トップ/検索/ログイン/エラーページ検出・
 * タイトル/本文抽出・公開日抽出までを行う。
 */
export async function validateArticleUrl(
  rawUrl: string,
  baseUrl: string,
  timeoutMs = 12000
): Promise<ValidationResult> {
  if (!rawUrl || isDangerousScheme(rawUrl)) return fail(rawUrl, 0, 'broken', '不正なスキーム');
  if (!isValidHttpUrl(rawUrl)) return fail(rawUrl, 0, 'broken', 'URL形式が不正');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  const reqUrl = /[^\x00-\x7F]/.test(rawUrl) ? encodeURI(rawUrl) : rawUrl;
  try {
    res = await fetch(reqUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/pdf' },
    });
  } catch (e: any) {
    clearTimeout(timer);
    const msg = String(e?.message || e);
    if (/abort/i.test(msg)) return fail(rawUrl, 0, 'temporarily_unavailable', 'タイムアウト');
    if (/certificate|ssl|tls/i.test(msg)) return fail(rawUrl, 0, 'broken', 'SSLエラー');
    return fail(rawUrl, 0, 'temporarily_unavailable', `接続失敗: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  const finalUrl = normalizeUrl(res.url || rawUrl);
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';
  const redirected = res.redirected || normalizeUrl(rawUrl) !== finalUrl;

  // ステータス判定 (spec §6.1 / §6.2)
  if (status === 404 || status === 410) return fail(finalUrl, status, 'broken', `HTTP ${status}`);
  if (status >= 500) return fail(finalUrl, status, 'temporarily_unavailable', `HTTP ${status}`);
  if (status < 200 || status >= 300) return fail(finalUrl, status, 'broken', `想定外のHTTP ${status}`);

  let finalU: URL;
  try { finalU = new URL(finalUrl); } catch { return fail(finalUrl, status, 'broken', 'URL解析失敗'); }

  // トップ/検索/ログインページ (spec §6.2)
  if (isTopPage(finalU, baseUrl)) return fail(finalUrl, status, 'broken', 'トップページに到達');
  if (looksLikeSearchPage(finalU)) return fail(finalUrl, status, 'broken', '検索結果ページに到達');

  // PDF等はタイトル/本文抽出が難しいため、フィード側情報で補完する前提でOK扱い
  if (/application\/pdf/i.test(contentType)) {
    return {
      ok: true, finalUrl, httpStatus: status, contentType,
      linkStatus: redirected ? 'redirected' : 'valid', validationError: null,
      title: '', description: '', bodyText: '', publishedAt: null,
      canonicalUrl: null, redirected,
    };
  }

  if (!/text\/html|application\/xhtml/i.test(contentType) && contentType) {
    return fail(finalUrl, status, 'broken', `記事ページではない (${contentType})`);
  }

  const html = await res.text();
  const ogTitle = meta(html, 'og:title');
  const htmlTitle = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities(ogTitle || htmlTitle || '').replace(/\s+/g, ' ').trim();
  const description = meta(html, 'og:description') || meta(html, 'description', 'name') || '';
  const bodyText = extractBody(html);
  const canonicalUrl = pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const publishedAt =
    meta(html, 'article:published_time') ||
    meta(html, 'datePublished', 'name') ||
    jsonLdDate(html) ||
    meta(html, 'pubdate', 'name') ||
    null;

  if (looksLikeLoginPage(finalU, title)) return fail(finalUrl, status, 'broken', 'ログイン画面に到達');
  if (looksLikeErrorPage(title, bodyText)) return fail(finalUrl, status, 'broken', 'エラーページに到達');
  if (title.length < MIN_TITLE) return fail(finalUrl, status, 'broken', 'タイトルを取得できない');
  if (bodyText.length < MIN_BODY && (description || '').length < MIN_BODY) {
    return fail(finalUrl, status, 'broken', '本文を取得できない');
  }

  return {
    ok: true, finalUrl, httpStatus: status, contentType,
    linkStatus: redirected ? 'redirected' : 'valid', validationError: null,
    title, description, bodyText, publishedAt,
    canonicalUrl: canonicalUrl ? normalizeUrl(canonicalUrl) : null, redirected,
  };
}

/** 公開済み記事のリンク切れ再確認用（軽量: ステータスと最終URLのみ） (spec §7) */
export async function recheckUrl(url: string, timeoutMs = 10000): Promise<{ linkStatus: LinkStatus; httpStatus: number; finalUrl: string; error: string | null }> {
  const r = await validateArticleUrl(url, url, timeoutMs);
  return { linkStatus: r.linkStatus, httpStatus: r.httpStatus, finalUrl: r.finalUrl, error: r.validationError };
}
