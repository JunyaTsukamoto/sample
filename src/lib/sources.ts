import type { SourceConfig } from "./types";

// フィードURLは初期値。実際に叩いて0件/404のものは運用しながら調整する（README参照）。
export const SOURCES: SourceConfig[] = [
  // --- AIサービス・技術動向 ---
  {
    id: "openai-blog",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    category: "AI_TECH",
    type: "rss",
  },
  {
    id: "anthropic-news",
    name: "Anthropic News",
    url: "https://www.anthropic.com/rss.xml",
    category: "AI_TECH",
    type: "rss",
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    category: "AI_TECH",
    type: "rss",
  },
  {
    id: "google-ai-blog",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    category: "AI_TECH",
    type: "rss",
  },

  // --- 国・行政の制度・政策 ---
  {
    id: "meti-press",
    name: "経済産業省 プレスリリース",
    url: "https://www.meti.go.jp/ml_index_j.rdf",
    category: "GOV_POLICY",
    type: "rss",
  },
  {
    id: "digital-agency",
    name: "デジタル庁",
    url: "https://www.digital.go.jp/rss/news.xml",
    category: "GOV_POLICY",
    type: "rss",
  },
  {
    id: "estat",
    name: "e-Stat 新着情報",
    url: "https://www.e-stat.go.jp/stat-search/rss/whatsnew",
    category: "GOV_POLICY",
    type: "rss",
  },
  {
    id: "kantei",
    name: "首相官邸",
    url: "https://www.kantei.go.jp/jp/rss/index.rdf",
    category: "GOV_POLICY",
    type: "rss",
  },

  // --- 社会課題・データサイエンス手法 ---
  {
    id: "qiita-datascience",
    name: "Qiita: データサイエンス",
    url: "https://qiita.com/tags/データサイエンス/feed",
    category: "SOCIAL_DATA_METHOD",
    type: "rss",
  },
  {
    id: "zenn-datascience",
    name: "Zenn: データサイエンス",
    url: "https://zenn.dev/topics/データサイエンス/feed",
    category: "SOCIAL_DATA_METHOD",
    type: "rss",
  },
  {
    id: "qiita-machine-learning",
    name: "Qiita: 機械学習",
    url: "https://qiita.com/tags/機械学習/feed",
    category: "SOCIAL_DATA_METHOD",
    type: "rss",
  },

  // --- 学術・研究トレンド（arXiv API） ---
  {
    id: "arxiv-cs-ai",
    name: "arXiv cs.AI",
    url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=30",
    category: "ACADEMIC_RESEARCH",
    type: "arxiv",
  },
  {
    id: "arxiv-cs-cy",
    name: "arXiv cs.CY",
    url: "https://export.arxiv.org/api/query?search_query=cat:cs.CY&sortBy=submittedDate&sortOrder=descending&max_results=30",
    category: "ACADEMIC_RESEARCH",
    type: "arxiv",
  },
  {
    id: "arxiv-stat-ap",
    name: "arXiv stat.AP",
    url: "https://export.arxiv.org/api/query?search_query=cat:stat.AP&sortBy=submittedDate&sortOrder=descending&max_results=30",
    category: "ACADEMIC_RESEARCH",
    type: "arxiv",
  },

  // --- 会社の新規事業動向 ---
  {
    id: "prtimes-all",
    name: "PR TIMES",
    url: "https://prtimes.jp/index.rdf",
    category: "CORPORATE_BUSINESS",
    type: "rss",
  },
];
