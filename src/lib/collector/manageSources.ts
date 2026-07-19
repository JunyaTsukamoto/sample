import fs from 'fs';
import path from 'path';
import { readDb, writeDb, Source } from '../db';

export interface ManageResult {
  retired: string[];   // 無効化したソース名
  added: string[];     // 補充したソース名
}

/**
 * 自己修復するソース管理 (ユーザー要望)。
 * - 連続失敗が threshold 回以上（既定6＝5超）のソースを自動で無効化。
 * - 無効化した数だけ、予備プール(config/backup-sources.json)から
 *   まだ使っていないソースを補充する（可能なら同カテゴリを優先）。
 */
export function manageSources(threshold = 6): ManageResult {
  const db = readDb();

  let pool: Source[] = [];
  try {
    pool = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'backup-sources.json'), 'utf-8'));
  } catch { /* プールが無ければ補充なし */ }

  const activeIds = new Set(db.sources.map((s) => s.id));

  // 1. 連続失敗が閾値以上のソースを無効化
  const failing = db.sources.filter((s) => s.enabled && (s.consecutiveFailures || 0) >= threshold);
  const retired: string[] = [];
  for (const s of failing) {
    s.enabled = false;
    retired.push(`${s.name}（連続失敗${s.consecutiveFailures}回）`);
  }

  // 2. 無効化した数だけ予備を補充（同カテゴリ優先、未使用のみ）
  const added: string[] = [];
  const available = pool.filter((b) => !activeIds.has(b.id));
  for (const s of failing) {
    if (available.length === 0) break;
    let idx = available.findIndex((b) => b.category === s.category);
    if (idx < 0) idx = 0;
    const b = available.splice(idx, 1)[0];
    db.sources.push({
      ...b, enabled: true, lastFetchedAt: null, lastSuccessAt: null, consecutiveFailures: 0,
    });
    activeIds.add(b.id);
    added.push(`${b.name}（${b.category}）`);
  }

  if (retired.length || added.length) writeDb(db);
  return { retired, added };
}
