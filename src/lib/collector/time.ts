/** Asia/Tokyo のタイムゾーンユーティリティ (spec §2.1, §10) */
export const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Tokyo';

/** DateをJSTの ISO8601 (+09:00) 文字列へ */
export function toJstIso(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${jst.getUTCFullYear()}-${p(jst.getUTCMonth() + 1)}-${p(jst.getUTCDate())}T` +
    `${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}:${p(jst.getUTCSeconds())}+09:00`;
}

export function nowJstIso(): string { return toJstIso(new Date()); }

/** 次回7時JSTの予定時刻を返す */
export function nextSevenAmJst(from = new Date()): string {
  const jstNow = new Date(from.getTime() + 9 * 3600 * 1000);
  const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
  let target = Date.UTC(y, m, d, 7 - 9, 0, 0); // 07:00 JST == 22:00 前日 UTC
  if (from.getTime() >= target) target += 24 * 3600 * 1000;
  return toJstIso(new Date(target));
}

/** 経過時間（時間） */
export function hoursSince(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / 3600000;
}
