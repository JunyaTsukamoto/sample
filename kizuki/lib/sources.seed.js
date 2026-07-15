// 初期情報源セット（ドラフト）。
// 「きづき要件定義書.md」8章 未確定事項#1の回答案（ハイブリッド方式）に対応する初期セット。
// 収集された記事は default_category をヒントにしつつ、実際のカテゴリ付けは
// lib/summarize.js の分類処理（LLM or キーワード）で決定する（複数カテゴリ可）。
//
// 社会科学×データサイエンス/シミュレーション/ゲーミングで社会課題解決に取り組む研究室での利用を
// 想定し、特定分野・特定媒体に偏らないよう「テック専門メディア」「政府・公的機関」「学術(arXiv)」
// 「個人/実践者の発信(Qiita/Zenn/Hacker News)」「プレスリリース」の5系統から広く収集する構成にした。
//
// フィードURLは変更・廃止される場合があるため、収集エラーが続く場合はURLの見直しが必要。
// 特に政府系フィード(kantei.go.jp等)はURLが変更されやすいため、収集エラーが出た場合は
// /sources 画面で無効化するか、実際のRSS URLを確認して更新すること。
// 運用しながら情報源マスタ(sources テーブル)に追加していくこと。

export const DEFAULT_SOURCES = [
  // --- テック専門メディア(AI中心) ---
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
    name: "INTERNET Watch",
    url: "https://internet.watch.impress.co.jp/data/rss/1.0/iw/feed.rdf",
    default_category: "society_data",
  },
  {
    name: "GIGAZINE",
    url: "https://gigazine.net/news/rss_2.0/",
    default_category: "society_data",
  },

  // --- 学術(arXiv) ---
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
    name: "arXiv cs.CY (Computers and Society)",
    url: "http://export.arxiv.org/rss/cs.CY",
    default_category: "academia",
  },
  {
    name: "arXiv econ.GN (General Economics)",
    url: "http://export.arxiv.org/rss/econ.GN",
    default_category: "academia",
  },

  // --- 政府・公的機関(制度分野の偏り是正用) ---
  {
    name: "首相官邸 新着情報",
    url: "https://www.kantei.go.jp/jp/rss/index.rdf",
    default_category: "institution",
  },
  {
    name: "NHKニュース",
    url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    default_category: "society_data",
  },

  // --- 個人/実践者の発信 ---
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

  // --- プレスリリース ---
  {
    name: "PR TIMES 新着プレスリリース",
    url: "https://prtimes.jp/index.rdf",
    default_category: "new_business",
  },
];
