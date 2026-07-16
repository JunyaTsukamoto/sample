// 公開済み記事のリンク切れ再確認 (spec §7)
import { readDb, writeDb } from '../src/lib/db';
import { recheckUrl } from '../src/lib/collector/validateUrl';
import { nowJstIso, hoursSince } from '../src/lib/collector/time';

/** 公開経過日数に応じて再確認対象か判定 (spec §7.1) */
function shouldRecheck(publishedAt: string, lastVerifiedAt?: string): boolean {
  const ageDays = hoursSince(publishedAt) / 24;
  const sinceVerify = lastVerifiedAt ? hoursSince(lastVerifiedAt) / 24 : Infinity;
  if (ageDays <= 7) return sinceVerify >= 1;    // 毎日
  if (ageDays <= 30) return sinceVerify >= 7;   // 週1
  return sinceVerify >= 30;                     // 月1
}

async function main() {
  const db = readDb();
  let checked = 0, broken = 0, recovered = 0;
  for (const a of db.articles) {
    if (a.published === false && a.linkStatus !== 'temporarily_unavailable') continue;
    if (!shouldRecheck(a.publishedAt, a.lastVerifiedAt)) continue;
    checked++;
    const r = await recheckUrl(a.finalUrl || a.url);
    a.lastVerifiedAt = nowJstIso();
    a.httpStatus = r.httpStatus;
    if (r.linkStatus === 'broken') {
      // 404/410 が継続 → 非公開 (spec §7.2)。別URLをAIで推測して差し替えない。
      a.linkStatus = 'broken';
      a.published = false;
      a.validationError = r.error;
      broken++;
    } else if (r.linkStatus === 'temporarily_unavailable') {
      a.linkStatus = 'temporarily_unavailable'; // 次回再確認対象として維持
      a.validationError = r.error;
    } else {
      if (a.published === false) recovered++;
      a.linkStatus = r.linkStatus; // valid / redirected
      a.published = true;
      a.validationError = null;
      if (r.finalUrl && r.linkStatus === 'redirected') { a.finalUrl = r.finalUrl; a.url = r.finalUrl; }
    }
    a.updatedAt = nowJstIso();
  }
  writeDb(db);
  console.log(`[recheck] checked=${checked} broken=${broken} recovered=${recovered}`);
}
main();
