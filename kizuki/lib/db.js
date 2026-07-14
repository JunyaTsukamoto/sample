import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SOURCES } from "./sources.seed.js";

// Node.js標準の node:sqlite を使用（Node v22.5以降）。better-sqlite3等のネイティブビルドは不要。
// DB接続・ディレクトリ作成は実際に使われる最初のタイミングまで遅延させる
// （`next build` 時点ではデプロイ先の永続ディスクがまだマウントされていないため）。

function resolveDbPath() {
  if (process.env.SQLITE_DATA_DIR) {
    return path.join(/*turbopackIgnore: true*/ process.env.SQLITE_DATA_DIR, "app.db");
  }
  return path.join(process.cwd(), "data", "app.db");
}

function createConnection() {
  const dbPath = resolveDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const conn = new DatabaseSync(dbPath);
  conn.exec("PRAGMA busy_timeout = 5000");
  conn.exec("PRAGMA journal_mode = WAL");
  return conn;
}

function initSchema(conn) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      default_category TEXT NOT NULL DEFAULT 'ai',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_content TEXT,
      summary TEXT,
      categories TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      topic_key TEXT,
      mention_count INTEGER NOT NULL DEFAULT 1,
      source_count INTEGER NOT NULL DEFAULT 1,
      trend_score REAL NOT NULL DEFAULT 0,
      bookmarked_at TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      llm_process_status TEXT NOT NULL DEFAULT 'pending' CHECK (llm_process_status IN ('pending', 'done', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(llm_process_status);
    CREATE INDEX IF NOT EXISTS idx_articles_topic_key ON articles(topic_key);

    -- 好みスコア（カテゴリ・タグ単位、EMAで段階的に更新される）
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      score REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- フィードバックの監査ログ（任意、集計や将来のチューニングに利用）
    CREATE TABLE IF NOT EXISTS feedback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      value INTEGER NOT NULL CHECK (value IN (-1, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
      fetched_count INTEGER NOT NULL DEFAULT 0,
      new_count INTEGER NOT NULL DEFAULT 0,
      summarized_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
  `);

  const sourceCount = conn.prepare("SELECT COUNT(*) AS c FROM sources").get().c;
  if (sourceCount === 0) {
    const insert = conn.prepare(`
      INSERT INTO sources (name, url, default_category, is_active)
      VALUES (@name, @url, @default_category, 1)
    `);
    conn.exec("BEGIN");
    try {
      for (const row of DEFAULT_SOURCES) insert.run(row);
      conn.exec("COMMIT");
    } catch (err) {
      conn.exec("ROLLBACK");
      throw err;
    }
  }
}

const globalForDb = globalThis;

function getRawDb() {
  if (!globalForDb.__kizukiDb) {
    const conn = createConnection();
    initSchema(conn);
    globalForDb.__kizukiDb = conn;
  }
  return globalForDb.__kizukiDb;
}

// 既存の `db.prepare(...)` / `db.exec(...)` 等の呼び出し方はそのまま使えるように、
// 実体へのアクセスをProxy経由にして遅延初期化する。
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getRawDb();
      const value = real[prop];
      return typeof value === "function" ? value.bind(real) : value;
    },
  }
);

export function runInTransaction(fn) {
  const conn = getRawDb();
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export function nowIso() {
  return new Date().toISOString();
}
