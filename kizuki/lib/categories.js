// 要件定義書「きづき要件定義書.md」3節のカテゴリ設計に対応。
export const CATEGORIES = [
  { id: "ai", label: "AI" },
  { id: "institution", label: "制度" },
  { id: "society_data", label: "社会×データ" },
  { id: "academia", label: "学術" },
  { id: "new_business", label: "新事業" },
];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// LLM未設定時のフォールバック（キーワードベースの簡易分類）用。
export const CATEGORY_KEYWORDS = {
  ai: ["ai", "生成ai", "llm", "機械学習", "深層学習", "エージェント", "chatgpt", "claude", "gemini"],
  institution: ["規制", "法律", "ガイドライン", "政策", "制度", "著作権", "規則", "省庁", "法案"],
  society_data: ["社会", "データ", "統計", "調査", "world", "働き方", "格差", "人口"],
  academia: ["論文", "研究", "arxiv", "学会", "大学", "研究者", "査読"],
  new_business: ["資金調達", "スタートアップ", "新事業", "サービス開始", "リリース", "提携", "買収", "startup"],
};

export function fallbackCategorize(text) {
  const lower = text.toLowerCase();
  const hits = CATEGORIES.filter((c) =>
    (CATEGORY_KEYWORDS[c.id] || []).some((kw) => lower.includes(kw.toLowerCase()))
  ).map((c) => c.id);
  return hits.length > 0 ? hits : ["ai"];
}
