# きづき

AI・社会の「兆し」を毎日キャッチアップするための個人用ニュースキュレーションアプリ。
要件は `../ai-tech-catchup/きづき要件定義書.md` を参照。

## セットアップ

```bash
npm install
npm run dev
```

`.env.local` に以下を設定（任意、未設定でもキーワードベースの簡易要約で動作する）:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-latest
SUMMARIZE_BATCH_SIZE=30
MAX_ARTICLE_AGE_DAYS=7
MUTATION_RATE=0.07
PREFERENCE_ALPHA=0.2
PREFERENCE_BETA=0.5
TREND_WEIGHT_MENTION=0.4
TREND_WEIGHT_SOURCE=0.3
TREND_WEIGHT_FRESHNESS=0.3
```

## バッチ実行

```bash
npm run batch          # 収集→要約→トレンドスコア再計算をローカルで直接実行
npm run trigger-collect # 常時稼働サーバーの /api/collect をHTTPで叩く（Render Cron向け）
```

## 主な機能

- カテゴリ（AI／制度／社会×データ／学術／新事業）ごとのタブ切り替え
- トレンドスコアリング（言及頻度・複数媒体掲載・鮮度の加重和）による優先表示
- 👍👎フィードバックによるEMA（指数移動平均）ベースの段階的パーソナライズ
- 一定確率（`MUTATION_RATE`）で好みスコアの低い記事を混入させる多様性確保
- ブックマーク（画面右上のアイコンから一覧を確認）
- ダークモード切り替え（デフォルトはライトモード）
