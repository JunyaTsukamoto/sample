import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SOURCES } from "./sources.seed.js";

// Node.jsに標準搭載の node:sqlite を使用（Node v22.5以降）。
// better-sqlite3等のネイティブビルドが不要なため、追加のビルドツールなしで動作する。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SQLITE_DATA_DIR が設定されていればそちらを使う（Renderの永続ディスクのマウント先など、
// リポジトリの場所と実際のデータ保存先を分離したいデプロイ環境向け）。未設定時は従来通り
// プロジェクト直下の data/ ディレクトリを使用する。
const DATA_DIR = process.env.SQLITE_DATA_DIR
  ? process.env.SQLITE_DATA_DIR
  : path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Reuse a single connection across hot-reloads in dev.
const globalForDb = globalThis;
export const db = globalForDb.__aiTechCatchupDb ?? new DatabaseSync(DB_PATH);
if (process.env.NODE_ENV !== "production") {
  globalForDb.__aiTechCatchupDb = db;
}

db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA journal_mode = WAL");

// better-sqlite3 の db.transaction(fn) 相当の簡易ヘルパー
export function runInTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      track_type TEXT NOT NULL CHECK (track_type IN ('trend', 'practice')),
      fetch_method TEXT NOT NULL DEFAULT 'rss',
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
      how_to_points TEXT,
      track_type TEXT NOT NULL CHECK (track_type IN ('trend', 'practice')),
      categories TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      cross_domain_tags TEXT NOT NULL DEFAULT '[]',
      practicality_score INTEGER,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      llm_process_status TEXT NOT NULL DEFAULT 'pending' CHECK (llm_process_status IN ('pending', 'done', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_track_type ON articles(track_type);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(llm_process_status);

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

  const sourceCount = db.prepare("SELECT COUNT(*) AS c FROM sources").get().c;
  if (sourceCount === 0) {
    const insert = db.prepare(`
      INSERT INTO sources (name, url, track_type, fetch_method, is_active)
      VALUES (@name, @url, @track_type, @fetch_method, 1)
    `);
    runInTransaction(() => {
      for (const row of DEFAULT_SOURCES) insert.run(row);
    });
  }
}

init();

export function nowIso() {
  return new Date().toISOString();
}
