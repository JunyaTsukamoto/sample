# きづき

AI・社会の「兆し」を毎日キャッチアップするための個人用ニュースキュレーションアプリ。
要件は `../ai-tech-catchup/きづき要件定義書.md` を参照。

## セットアップ

```bash
npm install
npm run dev
```

`.env.local` に以下を設定（任意、いずれも未設定ならキーワードベースの簡易要約で動作する）:

```
# LLM要約は次の優先順位で自動選択される: ANTHROPIC_API_KEY > GEMINI_API_KEY > 簡易要約
# LLM_PROVIDER=anthropic|gemini|none で明示的に固定することもできる。

# 有料・高品質: Claude API
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-latest

# 無料枠あり: Google Gemini API（https://aistudio.google.com/apikey でクレジットカード不要で発行可能）
# 固定バージョン(gemini-2.0-flash等)は無料枠の割り当てが0のプロジェクトがあるため、
# ローリングエイリアス(gemini-flash-lite-latest)をデフォルトにしている。
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-lite-latest
# Gemini無料枠は1分あたりのリクエスト数に厳しい上限があるため、記事間にこの間隔(ms)を空けて呼び出す
GEMINI_MIN_INTERVAL_MS=4200
# 429/503等の一時的なエラー時のリトライ回数
LLM_MAX_RETRIES=3

# 1回の収集で新規に取り込む記事数の上限
MAX_NEW_ARTICLES_PER_RUN=15
SUMMARIZE_BATCH_SIZE=15
MAX_ARTICLE_AGE_DAYS=7
MUTATION_RATE=0.07
PREFERENCE_ALPHA=0.2
PREFERENCE_BETA=0.5
TREND_WEIGHT_MENTION=0.4
TREND_WEIGHT_SOURCE=0.3
TREND_WEIGHT_FRESHNESS=0.3
```

Claude/Geminiどちらも未設定の場合、要約はキーワード抽出ベースの簡易処理にフォールバックする（要約文の質は落ちるが、収集・分類・トレンドスコアリングのパイプライン自体は動作する）。

## バッチ実行

```bash
npm run batch          # 収集→要約→トレンドスコア再計算をローカルで直接実行
npm run trigger-collect # 常時稼働サーバーの /api/collect をHTTPで叩く（Render Cron向け）
```

## 主な機能

- カテゴリ（AI／制度／社会×データ／学術／新事業）ごとのタブ切り替え
- 記事カードをタップすると、詳細画面を経由せず1回で元記事に直接アクセスできる
- トレンドスコアリング（言及頻度・複数媒体掲載・鮮度の加重和）による優先表示
- 👍👎フィードバックによるEMA（指数移動平均）ベースの段階的パーソナライズ
- 一定確率（`MUTATION_RATE`）で好みスコアの低い記事を混入させる多様性確保
- ブックマーク（画面右上のアイコンから一覧を確認）
- ダークモード切り替え（デフォルトはライトモード）
