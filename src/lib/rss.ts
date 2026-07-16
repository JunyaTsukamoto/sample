/**
 * @deprecated このモジュールは src/lib/collector/ に統合されました。
 * 記事取得は fetchFeed(), URL検証は validateArticleUrl(), 収集全体は runPipeline() を使用してください。
 */
export { fetchFeed } from './collector/fetchFeed';
export { runPipeline } from './collector/pipeline';
