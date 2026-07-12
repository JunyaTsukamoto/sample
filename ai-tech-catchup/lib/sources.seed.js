// 初期情報源セット（ドラフト）。
// 要件定義書 4.3節「情報源リストの確定について」の通り、これは初期セットであり
// 実運用の中で /sources 画面から自由に追加・削除・有効/無効切り替えを行うことを前提とする。
// フィードURLは変更・廃止される場合があるため、収集エラーが続く場合はURLの見直しが必要。

export const DEFAULT_SOURCES = [
  // --- 動向・トレンド系 (trend) ---
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    track_type: "trend",
    fetch_method: "rss",
  },
  {
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/feed/",
    track_type: "trend",
    fetch_method: "rss",
  },
  {
    name: "ITmedia AI+",
    url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    track_type: "trend",
    fetch_method: "rss",
  },
  {
    name: "GIGAZINE",
    url: "https://gigazine.net/news/rss_2.0/",
    track_type: "trend",
    fetch_method: "rss",
  },
  {
    name: "arXiv cs.AI (recent)",
    url: "http://export.arxiv.org/rss/cs.AI",
    track_type: "trend",
    fetch_method: "rss",
  },
  {
    name: "arXiv cs.CL (recent)",
    url: "http://export.arxiv.org/rss/cs.CL",
    track_type: "trend",
    fetch_method: "rss",
  },

  // --- 実践・模倣系 (practice) ---
  {
    name: "Qiita 人気記事 (AI)",
    url: "https://qiita.com/tags/AI/feed",
    track_type: "practice",
    fetch_method: "rss",
  },
  {
    name: "Qiita 人気記事 (生成AI)",
    url: "https://qiita.com/tags/生成AI/feed",
    track_type: "practice",
    fetch_method: "rss",
  },
  {
    name: "Zenn トピック: AI",
    url: "https://zenn.dev/topics/ai/feed",
    track_type: "practice",
    fetch_method: "rss",
  },
  {
    name: "Hacker News (frontpage)",
    url: "https://hnrss.org/frontpage",
    track_type: "practice",
    fetch_method: "rss",
  },
  {
    name: "Hacker News (Show HN)",
    url: "https://hnrss.org/show",
    track_type: "practice",
    fetch_method: "rss",
  },
];
