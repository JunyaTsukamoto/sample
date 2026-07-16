import React, { useState } from 'react';
import { Article } from '@/lib/db';
import { getRelativeTime } from '@/lib/utils';
import styles from './NewsCard.module.css';

interface NewsCardProps {
  article: Article;
  isBookmarked: boolean;
  onBookmarkToggle: (articleId: string) => void;
  onFeedback: (articleId: string, isLike: boolean) => void;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

const LINK_LABEL: Record<string, { text: string; color: string }> = {
  valid: { text: 'リンク有効', color: 'var(--accent)' },
  redirected: { text: 'リダイレクト', color: 'var(--accent)' },
  temporarily_unavailable: { text: '一時的に接続不可', color: 'var(--sparkle-color)' },
  broken: { text: 'リンク切れ', color: 'var(--danger)' },
  unverified: { text: '未検証', color: 'var(--text-muted)' },
};

export const NewsCard: React.FC<NewsCardProps> = ({ article, isBookmarked, onBookmarkToggle, onFeedback }) => {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const link = article.finalUrl || article.url;
  const linkOk = !!link && article.linkStatus !== 'broken' && article.linkStatus !== 'unverified';
  const badge = LINK_LABEL[article.linkStatus || 'unverified'];

  const handleLike = () => { if (feedback) return; setFeedback('like'); onFeedback(article.id, true); };
  const handleDislike = () => { if (feedback) return; setFeedback('dislike'); onFeedback(article.id, false); };

  return (
    <article className={`${styles.card} animate-fade-in`}>
      <div>
        <div className={styles.header}>
          <div className={styles.meta}>
            <span className={styles.source}>{article.source}</span>
            <span className={styles.time}>{getRelativeTime(article.publishedAt)}</span>
          </div>
          <button
            onClick={() => onBookmarkToggle(article.id)}
            className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarkActive : ''} click-bounce`}
            title={isBookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
            aria-label="Bookmark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        <div className={styles.categories}>
          {article.categories.map((cat) => (<span key={cat} className={styles.categoryBadge}>{cat}</span>))}
          {/* リンク状態バッジ (spec §13) */}
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: badge.color, border: `1px solid ${badge.color}`, opacity: 0.9 }}>
            {badge.text}
          </span>
        </div>

        <h3 className={styles.title}>
          {linkOk ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
              {article.title}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ) : (
            <span className={styles.titleLink} style={{ opacity: 0.6, cursor: 'not-allowed' }}>{article.title}</span>
          )}
        </h3>

        <p className={styles.summary}>{article.summary}</p>

        {/* 公開日 / 取得日 (spec §13) */}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          公開日: {fmtDate(article.publishedAt)} ・ 取得日: {fmtDate(article.collectedAt || article.scrapedAt)}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.tags}>
          {article.tags.map((tag) => (<span key={tag} className={styles.tag}>#{tag}</span>))}
        </div>

        {/* 元記事を読む (spec §13) */}
        <div style={{ marginTop: '0.5rem' }}>
          {linkOk ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className={`${styles.actionBtn} click-bounce`} style={{ textDecoration: 'none', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
              🔗 元記事を読む
            </a>
          ) : (
            <button className={styles.actionBtn} disabled title="リンクが無効なため開けません" style={{ opacity: 0.5, cursor: 'not-allowed' }}>🔗 元記事を読む</button>
          )}
        </div>

        <div className={styles.actions}>
          <button onClick={handleLike} className={`${styles.actionBtn} ${feedback === 'like' ? styles.likeActive : ''} click-bounce`} title="もっと見たい" disabled={feedback !== null}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            👍 もっと
          </button>
          <button onClick={handleDislike} className={`${styles.actionBtn} ${feedback === 'dislike' ? styles.dislikeActive : ''} click-bounce`} title="あまり興味ない" disabled={feedback !== null}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
            </svg>
            👎 興味薄
          </button>
        </div>
      </div>
    </article>
  );
};
export default NewsCard;
