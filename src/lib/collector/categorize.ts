const CATEGORY_KEYWORDS: Record<string, string[]> = {
  AI: ['ai', '人工知能', '機械学習', 'ml', 'llm', '生成ai', 'deep learning', 'ディープラーニング', 'gpt', 'transformer', 'neural', 'ニューラル', '大規模言語モデル', 'chatbot', 'エージェント'],
  制度: ['省', '庁', '政府', '法', '制度', 'ガイドライン', '規制', '政策', '条例', '自治体', '報道発表', '答申', 'デジタル庁', '総務省', '経済産業省', '国土交通省', '厚生労働省', '文部科学省', '内閣', 'パブリックコメント'],
  '社会×データ': ['統計', 'データ', '調査', '国勢', '人口', '社会課題', '格差', '気候', '環境', '医療データ', '公共', 'オープンデータ', '実証', 'ダッシュボード', '可視化'],
  学術: ['研究', '論文', 'arxiv', '大学', '学会', 'preprint', 'プレプリント', 'j-stage', 'science', 'nature', '実験', '理論', '発見', '解明', 'phd', '教授'],
  新事業: ['スタートアップ', '起業', '資金調達', 'シリーズ', 'ipo', 'vc', 'ベンチャー', '新規事業', 'ローンチ', 'プレスリリース', 'サービス開始', '提携', '買収', 'm&a', '上場'],
};

/** 記事のカテゴリを分類する (spec §5-14)。source既定カテゴリを基点に本文で補正。 */
export function classifyCategories(title: string, body: string, sourceCategory: string): string[] {
  const hay = (title + ' ' + body).toLowerCase();
  const scores: Record<string, number> = {};
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = kws.reduce((acc, k) => acc + (hay.includes(k.toLowerCase()) ? 1 : 0), 0);
  }
  // source既定カテゴリに加点
  if (scores[sourceCategory] !== undefined) scores[sourceCategory] += 1;
  const ranked = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const result = ranked.slice(0, 2).map(([c]) => c);
  return result.length > 0 ? result : [sourceCategory];
}

const TAG_KEYWORDS = [
  '生成AI', 'LLM', 'ChatGPT', '自動運転', 'ロボット', '半導体', '量子', 'セキュリティ', 'プライバシー',
  'データサイエンス', '気候変動', '脱炭素', 'DX', 'スマートシティ', 'ヘルスケア', 'フィンテック',
  '資金調達', 'IPO', 'M&A', '規制', 'ガイドライン', 'オープンデータ', '研究開発', '国内動向', '海外動向',
];

/** タグ付与 (spec §5-15)。本文・タイトルに現れるキーワードから最大3個。 */
export function extractTags(title: string, body: string, categories: string[]): string[] {
  const hay = title + ' ' + body;
  const found = TAG_KEYWORDS.filter((k) => hay.includes(k));
  const tags = [...found];
  // 不足時はカテゴリで補完
  for (const c of categories) { if (tags.length >= 2) break; if (!tags.includes(c)) tags.push(c); }
  return tags.slice(0, 3);
}
