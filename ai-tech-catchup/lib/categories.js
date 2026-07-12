// 要件定義書 6.3節のカテゴリ設計に対応。
export const CATEGORIES = [
  { id: "research_model", label: "研究・新モデル動向", track: "trend" },
  { id: "business", label: "ビジネス・企業動向", track: "trend" },
  { id: "policy_ethics", label: "社会・政策・研究倫理", track: "trend" },
  { id: "practical_tips", label: "実践Tips・ツール活用", track: "practice" },
  { id: "maker", label: "メイカー系事例（ハード×AI）", track: "practice" },
  { id: "generative", label: "生成系事例（コンテンツ×AI）", track: "practice" },
];

export const CROSS_DOMAIN_TAG = {
  id: "disaster_abm_gis",
  label: "防災・ABM・GIS関連",
};

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// フォールバック（LLM未設定時）のキーワード簡易判定用
export const CROSS_DOMAIN_KEYWORDS = [
  "防災",
  "災害",
  "避難",
  "地震",
  "津波",
  "ハザードマップ",
  "エージェントベース",
  "ABM",
  "agent-based",
  "agent based model",
  "GIS",
  "地理情報",
  "geospatial",
  "QGIS",
  "ArcGIS",
];

export const CATEGORY_KEYWORDS = {
  research_model: ["論文", "モデル", "arXiv", "研究", "benchmark", "release", "model"],
  business: ["資金調達", "買収", "提携", "企業", "funding", "startup", "IPO"],
  policy_ethics: ["規制", "倫理", "ガイドライン", "政策", "著作権", "policy", "regulation"],
  practical_tips: ["使い方", "活用", "tips", "how to", "チュートリアル", "プロンプト"],
  maker: ["ラズパイ", "raspberry pi", "3Dプリンタ", "3dプリンタ", "iot", "自作", "diy"],
  generative: ["生成", "画像生成", "動画生成", "音声生成", "generative", "image generation"],
};
