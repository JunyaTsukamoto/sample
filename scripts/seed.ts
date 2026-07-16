// 情報源DBを config/sources.json から初期化（既存の状態は保持）
import fs from 'fs';
import path from 'path';
import { readDb, writeDb, Source } from '../src/lib/db';

function loadConfig(): Source[] {
  const p = path.join(process.cwd(), 'config', 'sources.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function seedSources(): { added: number; total: number } {
  const db = readDb();
  const cfg = loadConfig();
  const byId = new Map(db.sources.map((s) => [s.id, s]));
  let added = 0;
  for (const c of cfg) {
    if (byId.has(c.id)) {
      // 設定の静的項目は更新、状態(lastFetchedAt等)は保持
      const cur = byId.get(c.id)!;
      byId.set(c.id, { ...c, lastFetchedAt: cur.lastFetchedAt, lastSuccessAt: cur.lastSuccessAt, consecutiveFailures: cur.consecutiveFailures, enabled: cur.enabled });
    } else {
      byId.set(c.id, c);
      added++;
    }
  }
  db.sources = Array.from(byId.values());
  writeDb(db);
  return { added, total: db.sources.length };
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  const r = seedSources();
  console.log(`情報源をシードしました: 追加 ${r.added} 件 / 合計 ${r.total} 件`);
}
