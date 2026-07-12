# AI技術動向キャッチアップアプリ

個人（研究者・大学院生）向けに、AI・技術分野の最新動向を毎朝キャッチアップするための自分専用Webアプリです。
要件定義書（`要件定義書.md`、別途作成済み）の技術構成案A（Next.js一体型）に基づいて実装しています。

RSS/APIで実際の記事を収集し、その本文をLLM（Claude API）に渡して要約・分類させる方式のため、
LLM単体にニュースを生成させる方式とは異なり、事実に基づかない内容（ハルシネーション）のリスクを抑えています。

## 構成

- フロントエンド/バックエンド: Next.js（App Router, JavaScript）
- DB: SQLite（Node.js標準搭載の `node:sqlite` を使用。ネイティブビルド不要。ファイルは `data/app.db` に作成されます。gitには含めません）
- 記事収集: `rss-parser` によるRSSフィード収集
- 要約・分類: Anthropic Claude API（`ANTHROPIC_API_KEY` 未設定時はキーワードベースの簡易処理にフォールバック）

## 動作要件

- Node.js v22.5以降（`node:sqlite` モジュールを使用するため。`node -v` で確認してください）

## セットアップ

```bash
cd ai-tech-catchup
npm install
cp .env.local.example .env.local
```

`.env.local` を編集し、Anthropic APIキーを設定してください（設定しない場合も動作しますが、要約は簡易的なものになります）。

```
ANTHROPIC_API_KEY=sk-ant-...
```

開発サーバーを起動:

```bash
npm run dev
```

`http://localhost:3000` を開くと一覧画面が表示されます。初回はDBが空なので、画面左の「今すぐ収集・要約」ボタンを押すか、下記のバッチスクリプトを実行してください。

## 画面

- `/` : 記事一覧（系統タブ「すべて/動向系/実践系」、カテゴリ・横断タグでフィルタ可能）
- `/articles/[id]` : 記事詳細（要約全文、手順ポイント、元記事リンク）
- `/sources` : 情報源の追加・削除・有効/無効切り替え
- `/status` : バッチ実行履歴・記事の処理状況

## 毎朝の自動実行（バッチ）を設定する

Webアプリを開かなくても、収集・要約だけを実行できるスタンドアロンスクリプトを用意しています。

```bash
npm run batch
# または
node scripts/run-batch.js
```

これをcron等で毎朝実行するように設定してください。

### macOSでのcron設定例

```bash
crontab -e
```

以下を追記（毎朝6:30に実行する例。パスは実際のプロジェクトの絶対パスに置き換えてください）:

```
30 6 * * * cd /path/to/ai-tech-catchup && /usr/local/bin/node scripts/run-batch.js >> /path/to/ai-tech-catchup/logs/batch.log 2>&1
```

`node` のパスは `which node` で確認してください。`.env.local` はスクリプトが自動で読み込みます。

cronではなくlaunchd（macOS推奨の常駐スケジューラ）を使いたい場合は、`~/Library/LaunchAgents/` にplistを配置する方法もあります。必要であれば別途相談してください。

## Renderへの公開デプロイ

Vercel/Netlifyのような一般的なサーバーレスホスティングは、リクエストのたびにファイルシステムがリセットされるため、
このアプリが使っているローカルSQLiteファイル（`node:sqlite`）が保存されず不向きです。
Renderは永続ディスクをアタッチできるため、コード変更なしでそのままデプロイできます。

**前提: RenderはGitHubリポジトリからのデプロイが基本です。** フォルダを直接ドラッグ&ドロップするような
アップロード機能はないため、事前にこのフォルダをGitHubリポジトリにpushしておく必要があります。

```bash
cd ai-tech-catchup
git init
git add .
git commit -m "initial commit"
# GitHubで空のリポジトリを作成した後、以下でpush
git remote add origin https://github.com/<your-account>/ai-tech-catchup.git
git push -u origin main
```

デプロイ手順:

1. [Render](https://render.com) にサインアップし、GitHubアカウントを連携する
2. ダッシュボードで「New +」→「Blueprint」を選択し、上記リポジトリを選ぶ
3. リポジトリ直下の `render.yaml` が自動検出され、以下の2つのサービスが作成される
   - `ai-tech-catchup`（Webサービス本体、永続ディスク付き）
   - `ai-tech-catchup-daily-batch`（毎日UTC 21:30 = 日本時間6:30頃に自動収集・要約を実行するCronジョブ）
4. デプロイ後、Webサービスの Environment タブで `ANTHROPIC_API_KEY` を設定する（未設定でも簡易要約で動作します）
5. デプロイ完了後に発行される `https://ai-tech-catchup-xxxx.onrender.com` のようなURLにアクセスして確認する

**料金について**: 永続ディスクはRenderの無料プランでは使えないため、`render.yaml` はWeb/Cronともに
最安の有料プラン `starter`（2026年時点で目安 月7ドル程度）を指定しています。無料で試したい場合は、
一時的に `plan: free` に変えてディスク設定を外し、DBが再デプロイのたびにリセットされる前提で動作確認だけ行う、
という使い方もできます。

**セキュリティについて**: このアプリは個人利用を想定しており認証機能がありません。Renderにデプロイすると
URLを知っている人なら誰でもアクセス・収集トリガーが可能になります。他人に共有しない、
必要であればRenderの有料プランのIP許可リスト機能等で制限することを検討してください。

## 情報源について（要確認・要調整）

`lib/sources.seed.js` に初期セットのRSSフィードを定義していますが、これはドラフトであり、フィードURLの変更・廃止によって収集できなくなる可能性があります。
`/sources` 画面、または `lib/sources.seed.js` を編集して、実際に使いたい情報源に調整してください。

- 動向系（trend）: Hugging Face Blog, MIT Technology Review, ITmedia AI+, GIGAZINE, arXiv cs.AI/cs.CL など
- 実践系（practice）: Qiita（AIタグ/生成AIタグ）, Zenn（AIトピック）, Hacker News（hnrss.org経由）など

OpenAI Blog、Google AI Blogなど一部の企業ブログはRSS提供状況が変わりやすいため、初期セットには含めていません。必要に応じて `/sources` 画面から追加してください。

## 未実装・今後の課題（要件定義書10章と対応）

- 情報源リストの最終確定（現状はドラフト）
- 記事本文の完全なスクレイピング（現状はRSSのdescription/summaryのみを利用。robots.txt順守の確認が必要）
- ハルシネーション検証（要約と原文の整合性チェック）
- 重複記事判定の高度化（現状はURL完全一致のみ）
- 認証・外部公開対応（現状は認証なし、localhost利用を想定）

## データのバックアップ

`data/app.db` にすべての記事・情報源データが保存されます。バックアップしたい場合はこのファイルをコピーしてください。
