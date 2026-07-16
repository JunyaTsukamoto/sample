'use client';

import { useState, useEffect } from 'react';
import { Article, Settings, Preferences } from '@/lib/db';
import NewsCard from '@/components/NewsCard';
import ChatBot from '@/components/ChatBot';
import ConfigModal from '@/components/ConfigModal';
import styles from './page.module.css';

export default function Home() {
  // State variables
  const [articles, setArticles] = useState<Article[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    categories: { 'AI': 1.0, '制度': 1.0, '社会×データ': 1.0, '学術': 1.0, '新事業': 1.0 },
    tags: {},
  });
  const [settings, setSettings] = useState<Settings>({
    mutationRate: 0.08,
    geminiApiKey: '',
  });
  const [meta, setMeta] = useState<any>(null);
  const [lastLog, setLastLog] = useState<any>(null);

  const [activeCategory, setActiveCategory] = useState<string>('すべて');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [configOpen, setConfigOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const categories = ['すべて', 'AI', '制度', '社会×データ', '学術', '新事業'];

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('kizuki-theme') as 'light' | 'dark' | null;
    // デフォルトは常にライトモード（保存済みの選択があればそれを優先）
    const initialTheme: 'light' | 'dark' = savedTheme || 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // Fetch articles from API
  const fetchArticles = async (cat = activeCategory, bookmarksOnly = showBookmarksOnly) => {
    setLoading(true);
    try {
      const url = new URL('/api/news', window.location.origin);
      if (cat !== 'すべて') {
        url.searchParams.append('category', cat);
      }
      if (bookmarksOnly) {
        url.searchParams.append('bookmarks', 'true');
      }
      
      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (data.articles) {
        setArticles(data.articles);
        setPreferences(data.preferences);
        setBookmarks(data.bookmarks);
        setSettings(data.settings);
        setMeta(data.meta || null);
        setLastLog(data.lastLog || null);
      }
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch articles on mount and whenever tab/bookmark filters change
  useEffect(() => {
    fetchArticles();
  }, [activeCategory, showBookmarksOnly]);

  // Toggle color theme
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('kizuki-theme', nextTheme);
  };

  // Bookmark actions
  const handleBookmarkToggle = async (articleId: string) => {
    try {
      const res = await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.bookmarks);
        // If we are on the bookmarks tab, remove the item immediately for responsive feel
        if (showBookmarksOnly) {
          setArticles(prev => prev.filter(a => a.id !== articleId));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Feedback actions (👍 / 👎)
  const handleFeedback = async (articleId: string, isLike: boolean) => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, isLike }),
      });
      const data = await res.json();
      if (data.success) {
        setPreferences(data.preferences);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Configuration actions
  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        fetchArticles(); // Refetch to apply new mutation rate or API key immediately
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Preferences reset
  const handleResetPreferences = async () => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPreferences(data.preferences);
        fetchArticles();
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Client-side search filtering
  const filteredArticles = articles.filter(article => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      article.title.toLowerCase().includes(q) ||
      article.originalTitle.toLowerCase().includes(q) ||
      article.summary.toLowerCase().includes(q) ||
      article.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  // Calculate last update time and total article counts
  const getLastUpdateTime = () => {
    if (articles.length === 0) return null;
    const latestScraped = [...articles].sort(
      (a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
    )[0];
    
    if (!latestScraped) return null;
    const date = new Date(latestScraped.scrapedAt);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  };

  const lastUpdateStr = getLastUpdateTime();

  const fmtMeta = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const jobFailed = meta?.lastJobStatus === 'failed';

  return (
    <div className={styles.container}>
      <main
        className={`${styles.mainContent} ${
          chatOpen ? styles.mainContentWithChat : ''
        }`}
      >
        {/* Header Section */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.logo}>
              きづき
              <span className={styles.logoSpark}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                </svg>
              </span>
            </h1>
            <div className={styles.stats}>
              {fmtMeta(meta?.lastSuccessAt) ? `最終更新: ${fmtMeta(meta.lastSuccessAt)} ・ ` : ''}
              {articles.length}件の兆し
            </div>
          </div>

          <div className={styles.controls}>
            {/* Bookmarks Toggle button */}
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={`${styles.iconBtn} ${showBookmarksOnly ? styles.iconBtnActive : ''} click-bounce`}
              title={showBookmarksOnly ? "すべての記事を表示" : "ブックマーク一覧"}
              aria-label="Bookmarks filter"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={showBookmarksOnly ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* AI Assistant Chat Toggle button */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`${styles.iconBtn} ${chatOpen ? styles.iconBtnActive : ''} click-bounce`}
              title="AIアシスタント"
              aria-label="Toggle Chat"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Theme Toggle button */}
            <button
              onClick={handleToggleTheme}
              className={`${styles.iconBtn} click-bounce`}
              title={theme === 'light' ? 'ダークモードへ' : 'ライトモードへ'}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {/* Config button */}
            <button
              onClick={() => setConfigOpen(true)}
              className={`${styles.iconBtn} click-bounce`}
              title="設定"
              aria-label="Configuration settings"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Search Bar Section */}
        <div className={styles.searchBar}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="記事タイトル、要約、ハッシュタグから検索..."
            className={styles.searchInput}
          />
        </div>

        {/* 収集ステータスバー (spec §14) */}
        <div style={{ margin: '0.25rem 0 0.75rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1.1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: jobFailed ? 'var(--danger)' : 'var(--accent)' }}>
            {jobFailed ? '⚠ 直近の収集は失敗（前回の有効記事を表示中）' : (meta?.lastSuccessAt ? `最終更新: ${fmtMeta(meta.lastSuccessAt)}` : '未収集')}
          </span>
          {meta?.lastCollectionAt && <span>最終収集: {fmtMeta(meta.lastCollectionAt)}</span>}
          {meta?.nextScheduledAt && <span>次回更新予定: {fmtMeta(meta.nextScheduledAt)}</span>}
          <span>本日の有効記事: {articles.length}件</span>
          {lastLog && <span>取得失敗の情報源: {lastLog.sourcesFailed}件</span>}
          <a href="/admin" style={{ marginLeft: 'auto', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>管理画面 →</a>
        </div>

        {/* Category Tabs Section */}
        <div className={styles.tabsContainer}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setShowBookmarksOnly(false); // Reset bookmarks view if switching category
              }}
              className={`${styles.tab} ${
                activeCategory === cat && !showBookmarksOnly ? styles.tabActive : ''
              }`}
            >
              {cat === 'すべて' ? 'すべて' : cat}
            </button>
          ))}
        </div>

        {/* Main News Feed Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
            <span className={styles.spin} style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}></span>
            <span>兆しを並び替え中...</span>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className={styles.feed}>
            {filteredArticles.map(article => (
              <NewsCard
                key={article.id}
                article={article}
                isBookmarked={bookmarks.includes(article.id)}
                onBookmarkToggle={handleBookmarkToggle}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>
              {showBookmarksOnly ? 'ブックマークした記事はありません' : '記事が見つかりません'}
            </h3>
            <p className={styles.emptyText}>
              {showBookmarksOnly
                ? '気になった記事のブックマークアイコンを押すと、ここに保存されます。'
                : '毎朝7時に自動収集されます。検索条件やカテゴリを変更してみてください。'}
            </p>
          </div>
        )}
      </main>

      {/* AI Chatbot slide-in panel */}
      {chatOpen && <ChatBot onClose={() => setChatOpen(false)} />}

      {/* Configuration Settings modal */}
      {configOpen && (
        <ConfigModal
          initialSettings={settings}
          preferences={preferences}
          onSave={handleSaveSettings}
          onResetPreferences={handleResetPreferences}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}
