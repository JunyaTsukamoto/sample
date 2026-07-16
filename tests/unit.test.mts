import test from 'node:test';
import assert from 'node:assert';
import { normalizeUrl, isValidHttpUrl, isDangerousScheme, contentHash, tokenize, jaccard, absolutize } from '../src/lib/collector/normalize.ts';
import { isDuplicate, registerSeen } from '../src/lib/collector/dedup.ts';
import { toJstIso, nextSevenAmJst, hoursSince } from '../src/lib/collector/time.ts';

test('normalizeUrl: トラッキングパラメータとフラグメントを除去', () => {
  const u = normalizeUrl('https://Example.com/a/?utm_source=x&b=2&fbclid=z#frag');
  assert.ok(!u.includes('utm_source'));
  assert.ok(!u.includes('fbclid'));
  assert.ok(!u.includes('#frag'));
  assert.ok(u.includes('b=2'));
  assert.ok(u.startsWith('https://example.com'));
});

test('isValidHttpUrl / isDangerousScheme', () => {
  assert.equal(isValidHttpUrl('https://a.com/x'), true);
  assert.equal(isValidHttpUrl('ftp://a.com'), false);
  assert.equal(isDangerousScheme('javascript:alert(1)'), true);
  assert.equal(isDangerousScheme('data:text/html;base64,xx'), true);
  assert.equal(isDangerousScheme('https://a.com'), false);
});

test('absolutize: 相対URLを絶対URLに変換', () => {
  assert.equal(absolutize('/articles/1', 'https://a.com/x/'), 'https://a.com/articles/1');
});

test('dedup: 正規化URL・タイトル類似・ハッシュで重複判定', () => {
  const seenUrls = new Set(); const seenHashes = new Set(); const seenTok:any[] = [];
  const a = { url:'https://a.com/1', finalUrl:'https://a.com/1', title:'生成AIの新しい研究成果を大学が発表', contentHash:'h1' };
  assert.equal(isDuplicate(a as any, seenUrls, seenHashes, seenTok), false);
  registerSeen(a as any, seenUrls, seenHashes, seenTok);
  // 同一URL(トラッキング付き)は重複
  const b = { url:'https://a.com/1?utm_source=x', finalUrl:'https://a.com/1?utm_source=x', title:'別タイトル', contentHash:'h2' };
  assert.equal(isDuplicate(b as any, seenUrls, seenHashes, seenTok), true);
  // 同一ハッシュは重複
  const c = { url:'https://a.com/2', finalUrl:'https://a.com/2', title:'まったく違う見出し', contentHash:'h1' };
  assert.equal(isDuplicate(c as any, seenUrls, seenHashes, seenTok), true);
});

test('time: JST ISOは+09:00、7時JST予定は未来', () => {
  const iso = toJstIso(new Date('2026-07-15T00:00:00Z'));
  assert.ok(iso.endsWith('+09:00'));
  assert.equal(iso.slice(0,13), '2026-07-15T09');
  const next = nextSevenAmJst(new Date('2026-07-16T05:00:00+09:00'));
  assert.ok(next.includes('T07:00:00+09:00'));
});

test('jaccard/tokenize: 類似タイトルは高スコア', () => {
  const s = jaccard(tokenize('生成AIの新しい研究成果を大学が発表'), tokenize('生成AIの新しい研究成果を大学が発表'));
  assert.ok(s >= 0.99);
});
