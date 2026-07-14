// 初期情報源セット（ドラフト）。
// 「きづき要件定義書.md」8章 未確定事項#1の回答案（ハイブリッド方式）に対応する初期セット。
// 収集された記事は default_category をヒントにしつつ、実際のカテゴリ付けは
// lib/summarize.js の分類処理（LLM or キーワード）で決定する（複数カテゴリ可）。
// フィードURLは変更・廃止される場合があるため、収集エラーが続く場合はURLの見直しが必要。
// 特に「制度」分野に特化したフィードは未選定のため、他ソースからのキーワード分類に頼っている。
// 運用しながら情報源マスタ(sources テーブル)に追加していくこと。

export const DEFAULT_SOURCES = [
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    default_category: "ai",
  },
  {
    name: "ITmedia AI+",
    url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    default_category: "ai",
  },
  {
    name: "ITmedia NEWS",
    url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
    default_category: "society_data",
  },
  {
    name: "GIGAZINE",
    url: "https://gigazine.net/news/rss_2.0/",
    default_category: "society_data",
  },
  {
    name: "arXiv cs.AI (recent)",
    url: "http://export.arxiv.org/rss/cs.AI",
    default_category: "academia",
  },
  {
    name: "arXiv cs.CL (recent)",
    url: "http://export.arxiv.org/rss/cs.CL",
    default_category: "academia",
  },
  {
    name: "Qiita タグ:AI",
    url: "https://qiita.com/tags/AI/feed",
    default_category: "ai",
  },
  {
    name: "Zenn トピック:AI",
    url: "https://zenn.dev/topics/ai/feed",
    default_category: "ai",
  },
  {
    name: "Hacker News (frontpage)",
    url: "https://hnrss.org/frontpage",
    default_category: "new_business",
  },
  {
    name: "PR TIMES 新着プレスリリース",
    url: "https://prtimes.jp/index.rdf",
    default_category: "new_business",
  },
];
