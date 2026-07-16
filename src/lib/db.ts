import fs from 'fs';
import path from 'path';

// ===== 型定義 =====

/** リンク状態 (spec §8) */
export type LinkStatus =
  | 'valid'
  | 'redirected'
  | 'temporarily_unavailable'
  | 'broken'
  | 'unverified';

/** 情報源 (spec §4) */
export interface Source {
  id: string;
  name: string;
  baseUrl: string;
  feedUrl: string;
  type: 'rss' | 'atom' | 'api' | 'html' | 'manual';
  category: string;
  enabled: boolean;
  reliabilityScore: number;
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
}

/** 記事 (spec §8)。旧UI互換フィールド(url, scrapedAt 等)も保持。 */
export interface Article {
  id: string;
  category?: string;
  title: string;
  originalTitle: string;
  summary: string;
  summarySource?: string; // 'llm' | 'extractive' | 'feed_description'
  source: string;
  sourceId?: string;
  url: string;            // = finalUrl（旧UI互換。カード内リンクに使用）
  originalUrl?: string;   // フィードから得た生URL
  finalUrl?: string;      // リダイレクト後の最終URL
  publishedAt: string;    // 公開日時 (ISO, +09:00)
  collectedAt?: string;   // 収集日時
  scrapedAt: string;      // 旧UI互換（= collectedAt）
  lastVerifiedAt?: string;
  httpStatus?: number;
  contentType?: string;
  linkStatus?: LinkStatus;
  validationError?: string | null;
  categories: string[];
  tags: string[];
  thumbnailUrl?: string | null;
  published?: boolean;
  reliabilityScore?: number;
  contentHash?: string;
  trendScore: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 収集ジョブのログ (spec §15) */
export interface CollectionLog {
  jobId: string;
  scheduledAt: string;
  startedAt: string;
  finishedAt: string;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  candidatesFound: number;
  duplicatesRemoved: number;
  invalidUrlsRemoved: number;
  articlesPublished: number;
  errors: { sourceId?: string; message: string }[];
}

export interface Preferences {
  categories: Record<string, number>;
  tags: Record<string, number>;
}

export interface Settings {
  mutationRate: number;
  geminiApiKey: string;
}

export interface Meta {
  lastCollectionAt: string | null;
  lastSuccessAt: string | null;
  nextScheduledAt: string | null;
  lastJobStatus: CollectionLog['status'] | null;
}

export interface DbData {
  articles: Article[];
  sources: Source[];
  logs: CollectionLog[];
  meta: Meta;
  preferences: Preferences;
  bookmarks: string[];
  settings: Settings;
}

// ===== 保存先 =====

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULT_PREFS: Preferences = {
  categories: { AI: 1.0, 制度: 1.0, '社会×データ': 1.0, 学術: 1.0, 新事業: 1.0 },
  tags: {},
};

const DEFAULT_DB: DbData = {
  articles: [],
  sources: [],
  logs: [],
  meta: { lastCollectionAt: null, lastSuccessAt: null, nextScheduledAt: null, lastJobStatus: null },
  preferences: DEFAULT_PREFS,
  bookmarks: [],
  settings: { mutationRate: 0.08, geminiApiKey: '' },
};

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
}

export function readDb(): DbData {
  ensureDb();
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    return {
      ...DEFAULT_DB,
      ...raw,
      meta: { ...DEFAULT_DB.meta, ...(raw.meta || {}) },
      preferences: { ...DEFAULT_PREFS, ...(raw.preferences || {}) },
      settings: { ...DEFAULT_DB.settings, ...(raw.settings || {}) },
      sources: raw.sources || [],
      logs: raw.logs || [],
    };
  } catch (e) {
    console.error('Failed to read database:', e);
    return { ...DEFAULT_DB };
  }
}

export function writeDb(data: DbData): void {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ===== 記事 =====

/** 一般利用者向け: published かつ unverified/broken 以外のみ (spec §8, §13) */
export function getPublishedArticles(): Article[] {
  return readDb().articles.filter(
    (a) => a.published !== false && a.linkStatus !== 'unverified' && a.linkStatus !== 'broken'
  );
}

/** 管理画面用: 全記事 */
export function getArticles(): Article[] {
  return readDb().articles;
}

export function saveArticles(newArticles: Article[]): void {
  const db = readDb();
  const map = new Map<string, Article>();
  db.articles.forEach((a) => map.set(a.id, a));
  newArticles.forEach((a) => map.set(a.id, a));
  db.articles = Array.from(map.values());
  writeDb(db);
}

// ===== 情報源 =====

export function getSources(): Source[] { return readDb().sources; }
export function saveSources(sources: Source[]): void {
  const db = readDb(); db.sources = sources; writeDb(db);
}

// ===== ログ / メタ =====

export function appendLog(log: CollectionLog): void {
  const db = readDb();
  db.logs.unshift(log);
  db.logs = db.logs.slice(0, 100);
  db.meta.lastCollectionAt = log.finishedAt;
  db.meta.lastJobStatus = log.status;
  if (log.status === 'success' || log.status === 'partial_success') db.meta.lastSuccessAt = log.finishedAt;
  writeDb(db);
}
export function getLogs(): CollectionLog[] { return readDb().logs; }
export function getMeta(): Meta { return readDb().meta; }
export function setMeta(patch: Partial<Meta>): Meta {
  const db = readDb(); db.meta = { ...db.meta, ...patch }; writeDb(db); return db.meta;
}

// ===== 設定 / 嗜好 / ブックマーク（旧UI互換） =====

export function updatePreference(type: 'categories' | 'tags', key: string, isLike: boolean): Preferences {
  const db = readDb();
  const alpha = 0.2;
  if (!db.preferences[type]) db.preferences[type] = {};
  const cur = db.preferences[type][key] ?? 1.0;
  const target = isLike ? 2.0 : 0.1;
  db.preferences[type][key] = Math.max(0.05, Math.min(5.0, cur * (1 - alpha) + target * alpha));
  writeDb(db);
  return db.preferences;
}

export function toggleBookmark(articleId: string): string[] {
  const db = readDb();
  const i = db.bookmarks.indexOf(articleId);
  if (i >= 0) db.bookmarks.splice(i, 1); else db.bookmarks.push(articleId);
  writeDb(db);
  return db.bookmarks;
}

export function getSettings(): Settings { return readDb().settings; }
export function saveSettings(settings: Partial<Settings>): Settings {
  const db = readDb(); db.settings = { ...db.settings, ...settings }; writeDb(db); return db.settings;
}
