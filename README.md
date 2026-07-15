# Lab News Feed

研究室向けパーソナライズ・ニュースフィード（PWA）。AI技術動向・政策/行政・社会課題/データサイエンス手法・学術研究トレンド・企業の新規事業動向を毎朝7時(JST)に自動収集し、閲覧（クリック/いいね/非表示）から興味を学習してフィードの並びを調整します。

## 技術スタック

- Next.js 16 (App Router, TypeScript) + Tailwind CSS
- Prisma 7 + `@prisma/adapter-pg`（Postgres用ドライバアダプタ）
- Vercel Cron（毎朝7時JSTにRSS/Atom/arXivを収集）
- 手書きの最小限PWA（`public/manifest.json` + `public/sw.js`。ホーム画面追加が主目的で、フルオフライン対応はスコープ外）

**注意**: このプロジェクトは `next dev` / `next build` を明示的に `--webpack` で実行するよう設定しています（package.json参照）。Next.js 16 のデフォルトである Turbopack は、日本語を含むフォルダパス（本プロジェクトの絶対パス）でクラッシュするバグがあったための回避策です。Vercelへのデプロイ時はビルド環境のパスに日本語が含まれないため問題になりませんが、ローカル開発時はこのままにしてください。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

`postinstall` で `prisma generate` が自動実行されます。

### 2. データベースを用意する（ユーザー側での作業が必要です）

[Neon](https://neon.tech) または [Supabase](https://supabase.com) などで無料のPostgresプロジェクトを作成し、接続文字列（`DATABASE_URL`）を取得してください。アカウント作成はご自身で行っていただく必要があります。

`.env` を作成し、`.env.example` を参考に値を設定してください：

```bash
cp .env.example .env
```

```
DATABASE_URL="postgresql://..."
CRON_SECRET="（ランダムな文字列。openssl rand -hex 32 などで生成）"
```

### 3. マイグレーション実行

```bash
npx prisma migrate dev --name init
```

### 4. ローカル起動

```bash
npm run dev
```

http://localhost:3000 を開き、「今すぐ更新」ボタンを押すと収集が走ります（`prisma studio` でArticle/Interaction/Affinityテーブルの中身を確認できます）。

### 5. Vercelへデプロイ

1. GitHubリポジトリを作成しpush（またはVercel CLIで直接デプロイ）
2. Vercelでプロジェクトをインポート
3. Vercelダッシュボードの環境変数に `DATABASE_URL` と `CRON_SECRET` を設定
4. デプロイ後、`vercel.json` の cron設定（毎日UTC22:00=JST7:00に `/api/cron/refresh` を実行）が自動的に有効になります

### 6. iPhoneでホーム画面に追加

デプロイ後のURLをiPhoneのSafariで開き、共有ボタン→「ホーム画面に追加」でPWAとしてインストールできます。

## 収集元の調整

`src/lib/sources.ts` に収集元（RSS/Atom/arXiv）の一覧があります。初期値のURLは動作未検証のものを含むため、実際に「今すぐ更新」を実行した際のレスポンス（`sourceErrors`）や本番Cronのログを見て、0件/404のソースを調整してください。

## パーソナライズの仕組み

- 記事へのview/click/like/dismissを `Interaction` テーブルに記録
- カテゴリ・情報源・タグごとの好感度スコアを `Affinity` テーブルで漸進更新（`src/lib/affinity.ts`）
- フィードの並び順は「鮮度（半減期36時間）」と「好感度スコア」を組み合わせて計算（`src/lib/ranking.ts`）
- 非表示にした記事はフィードの候補から除外されます
