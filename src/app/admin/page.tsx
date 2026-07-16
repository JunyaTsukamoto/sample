'use client';
import { useEffect, useState } from 'react';

const LINK_COLOR: Record<string, string> = {
  valid: '#0d9488', redirected: '#0d9488', temporarily_unavailable: '#d97706', broken: '#ef4444', unverified: '#94a3b8',
};
function fmt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Admin() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'sources' | 'logs' | 'articles'>('sources');
  const [busy, setBusy] = useState(false);

  const load = async () => { const r = await fetch('/api/admin'); setData(await r.json()); };
  useEffect(() => { load(); }, []);

  const post = async (payload: any) => { await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); load(); };
  const manualCollect = async () => {
    setBusy(true);
    try { const r = await fetch('/api/fetch', { method: 'POST' }); const j = await r.json(); alert(j.message || j.error); await load(); }
    finally { setBusy(false); }
  };

  const S: any = {
    wrap: { maxWidth: 1100, margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, sans-serif', color: 'var(--text-primary)' },
    tab: (on: boolean) => ({ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: 8, background: on ? 'var(--primary)' : 'var(--bg-card)', color: on ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }),
    th: { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' },
    td: { padding: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', verticalAlign: 'top' },
    btn: { padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.72rem' },
  };
  if (!data) return <div style={S.wrap}>読み込み中…</div>;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>きづき 管理画面</h1>
        <a href="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>← フィードへ戻る</a>
        <button onClick={manualCollect} disabled={busy} style={{ ...S.btn, marginLeft: 'auto', background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>
          {busy ? '収集中…' : '手動で記事収集を実行'}
        </button>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        最終収集: {fmt(data.meta?.lastCollectionAt)} ・ 成功: {fmt(data.meta?.lastSuccessAt)} ・ 次回予定: {fmt(data.meta?.nextScheduledAt)} ・ 状態: {data.meta?.lastJobStatus || '—'}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button style={S.tab(tab === 'sources')} onClick={() => setTab('sources')}>情報源管理</button>
        <button style={S.tab(tab === 'logs')} onClick={() => setTab('logs')}>収集履歴</button>
        <button style={S.tab(tab === 'articles')} onClick={() => setTab('articles')}>記事検証</button>
      </div>

      {tab === 'sources' && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={S.th}>情報源名</th><th style={S.th}>種別</th><th style={S.th}>カテゴリ</th><th style={S.th}>URL</th>
            <th style={S.th}>最終取得</th><th style={S.th}>最終成功</th><th style={S.th}>連続失敗</th><th style={S.th}>信頼度</th><th style={S.th}>有効</th>
          </tr></thead>
          <tbody>{data.sources.map((s: any) => (
            <tr key={s.id}>
              <td style={S.td}>{s.name}</td><td style={S.td}>{s.type}</td><td style={S.td}>{s.category}</td>
              <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}><a href={s.feedUrl} target="_blank" rel="noopener noreferrer">{s.feedUrl || '—'}</a></td>
              <td style={S.td}>{fmt(s.lastFetchedAt)}</td><td style={S.td}>{fmt(s.lastSuccessAt)}</td>
              <td style={{ ...S.td, color: s.consecutiveFailures > 0 ? '#ef4444' : undefined }}>{s.consecutiveFailures}</td>
              <td style={S.td}>{s.reliabilityScore}</td>
              <td style={S.td}><button style={S.btn} onClick={() => post({ action: 'toggle-source', sourceId: s.id })}>{s.enabled ? '有効' : '無効'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {tab === 'logs' && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={S.th}>実行日時</th><th style={S.th}>状態</th><th style={S.th}>候補</th><th style={S.th}>公開</th>
            <th style={S.th}>重複除外</th><th style={S.th}>無効URL</th><th style={S.th}>情報源(成功/試行)</th><th style={S.th}>エラー</th>
          </tr></thead>
          <tbody>{data.logs.map((l: any) => (
            <tr key={l.jobId}>
              <td style={S.td}>{fmt(l.finishedAt)}</td>
              <td style={{ ...S.td, fontWeight: 700, color: l.status === 'failed' ? '#ef4444' : l.status === 'partial_success' ? '#d97706' : '#0d9488' }}>{l.status}</td>
              <td style={S.td}>{l.candidatesFound}</td><td style={S.td}>{l.articlesPublished}</td>
              <td style={S.td}>{l.duplicatesRemoved}</td><td style={S.td}>{l.invalidUrlsRemoved}</td>
              <td style={S.td}>{l.sourcesSucceeded}/{l.sourcesAttempted}</td>
              <td style={{ ...S.td, maxWidth: 260, fontSize: '0.7rem', color: '#ef4444' }}>{(l.errors || []).map((e: any) => e.message).join(' / ')}</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {tab === 'articles' && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={S.th}>記事タイトル</th><th style={S.th}>最終URL</th><th style={S.th}>HTTP</th><th style={S.th}>リンク状態</th>
            <th style={S.th}>公開</th><th style={S.th}>最終確認</th><th style={S.th}>要約(取得元)</th><th style={S.th}>操作</th>
          </tr></thead>
          <tbody>{data.articles.map((a: any) => (
            <tr key={a.id}>
              <td style={{ ...S.td, maxWidth: 220 }}>{a.title}</td>
              <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}><a href={a.finalUrl} target="_blank" rel="noopener noreferrer">{a.finalUrl}</a></td>
              <td style={S.td}>{a.httpStatus || '—'}</td>
              <td style={{ ...S.td, color: LINK_COLOR[a.linkStatus] || undefined, fontWeight: 700 }}>{a.linkStatus}</td>
              <td style={S.td}>{a.published ? '公開' : '非公開'}</td>
              <td style={S.td}>{fmt(a.lastVerifiedAt)}</td>
              <td style={{ ...S.td, maxWidth: 240 }} title={a.summary}><span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>[{a.summarySource}]</span> {a.summary?.slice(0, 40)}…</td>
              <td style={S.td}>
                <button style={S.btn} onClick={() => post({ action: 'recheck', articleId: a.id })}>URL再確認</button>{' '}
                {a.published && <button style={S.btn} onClick={() => post({ action: 'unpublish', articleId: a.id })}>非公開</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
