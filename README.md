# きづき ― 社会とAIの兆しを見つける

社会とAIに関する「兆し（トレンドの初期シグナル）」を、**実在するニュース・行政・研究機関・企業公式サイト等**から
毎朝自動収集・URL検証・要約して届ける、パーソナライズ型ニュースキュレーションアプリです。

既存のUI（レスポンシブ／カテゴリ／評価／ブックマーク／学習状況／ライト・ダークモード／PWA）を維持したまま、
**実在記事の自動収集機能**を追加しています。架空記事・固定サンプル・推測URLは本番フィードに表示しません。

---

## 1. 使用技術

| 領域 | 技術 |
| --- | --- |
| フロントエンド | Next.js 15 (App Router), React 19, CSS Modules |
| バックエンドAPI | Next.js Route Handlers (`/api/*`) |
| データベース | ファイルDB (`data/db.json`)。将来 `DATABASE_URL` でRDBへ移行可 |
| 記事収集 | Node + `rss-parser`（RSS/Atom）＋ 標準 `fetch`（HTML検証・本文取得） |
| 要約 | 抽出要約（既定・キー不要）／ Google Gemini（`GEMINI_API_KEY` 設定時） |
| 定期実行 | **GitHub Actions schedule（サーバー側cron）** |
| PWA | `manifest.webmanifest` + Service Worker（アプリシェル） |
| テスト | `node:test`（URL正規化・重複排除・タイムゾーン・検証分類） |

> 収集はサーバー側（GitHub Actions）で実行されます。ブラウザの `setTimeout` や Service Worker では収集しません（意図的）。

---

## 2. ローカル起動方法

```bash
npm install
npm run seed          # config/sources.json から情報源をDBへ登録
npm run collect --   --force   # 記事を1回収集（実在記事のみ登録）
npm run dev           # http://localhost:3000
```

- フィード: `http://localhost:3000/`
- 管理画面: `http://localhost:3000/admin`

---

## 3. データベースの準備方法

既定はファイルDBのため準備は不要です。初回に `data/db.json` が自動生成されます。

```bash
npm run seed   # 情報源(sources)を投入。記事(articles)は空のまま
```

`data/db.json` の構造: `articles` / `sources` / `logs` / `meta` / `preferences` / `bookmarks` / `settings`。

---

## 4. 環境変数の設定方法

`.env.example` をコピーして `.env` を作成します（`.env` はコミットしないこと）。

```bash
cp .env.example .env
```

| 変数 | 用途 | 未設定時 |
| --- | --- | --- |
| `APP_TIMEZONE` | タイムゾーン | `Asia/Tokyo` |
| `USE_MOCK_DATA` | 開発用モックの有効化 | `false`（本番でtrueならビルド失敗） |
| `GEMINI_API_KEY` | LLM要約・チャット | 抽出要約にフォールバック |
| `NEWS_API_KEY` | ニュースAPI型情報源 | 該当情報源を自動無効化 |
| `CRON_SECRET` | `/api/fetch` 手動収集の保護 | 認証なしで実行可 |
| `DATABASE_URL` | 将来のRDB移行用 | 未使用 |

**APIキーはフロントエンドコードに直接書きません。** サーバー側（Route Handler / スクリプト / GitHub Secrets）でのみ参照します。

---

## 5. 情報源の追加・削除方法

`config/sources.json` を編集します。1情報源＝1オブジェクト。

```json
{
  "id": "src-example",
  "name": "情報源名",
  "baseUrl": "https://example.com/",
  "feedUrl": "https://example.com/rss.xml",
  "type": "rss",            // rss | atom | api | html | manual
  "category": "AI",          // AI | 制度 | 社会×データ | 学術 | 新事業
  "enabled": true,
  "reliabilityScore": 0.9,
  "lastFetchedAt": null,
  "lastSuccessAt": null,
  "consecutiveFailures": 0
}
```

編集後に `npm run seed` を実行するとDBへ反映されます（既存の取得状態は保持）。
管理画面（`/admin` → 情報源管理）から有効・無効の切替も可能です。

- **API/RSSが提供されている場合はスクレイピングより優先**してください。
- 認証・有料契約が必要なAPIは、キー未設定時に自動的に無効化され、架空レスポンスで代替しません。
- robots.txt・利用規約・著作権に配慮してください。

---

## 6. 記事収集処理の手動実行方法

```bash
npm run collect -- --force     # コマンドラインから即時実行
```

または管理画面 `/admin` の「手動で記事収集を実行」ボタン（内部で `POST /api/fetch` を呼び出し）。
`CRON_SECRET` を設定した場合は `Authorization: Bearer <CRON_SECRET>` が必要です。

---

## 7. 毎朝5時の定期実行設定（サーバー側cron）

`.github/workflows/collect.yml` により **GitHub Actions** が自動実行します。
GitHub Actions はクラウド上で動くため、**利用者がブラウザ／PWAを閉じていても実行**されます。

```yaml
on:
  schedule:
    - cron: '0 22 * * *'   # 05:00 JST（cronはUTC。JST−9時間）
    - cron: '15 20 * * *'  # 05:15 JST（再実行）
    - cron: '30 20 * * *'  # 05:30 JST（再実行）
    - cron: '0 21 * * *'   # 06:00 JST（再実行）
```

- 収集が成功するとその日はスキップ（同日重複実行の防止）。失敗時のみ次の時刻が再試行になります。
- 収集結果（`data/`・`public/data/`）は Bot が自動コミットします。
- 必要な Secrets: `GEMINI_API_KEY`（任意）, `NEWS_API_KEY`（任意）。
  リポジトリ Settings → Secrets and variables → Actions で設定します。
- 手動起動は Actions タブ → collect-news → Run workflow。

> Vercel等でホスティングする場合、フロントエンドはコミット済みの `data/db.json` を読み取ります。
> 収集そのものは Vercel のサーバーレス関数では永続化できないため GitHub Actions が担当します。

---

## 8. タイムゾーンの設定

- 既定 `Asia/Tokyo`。`APP_TIMEZONE` と GitHub Actions の `TZ: Asia/Tokyo` で統一。
- 公開日時・収集日時・次回予定はすべて JST（`+09:00`）で保存・表示されます。
- 過去24〜72時間以内に公開された記事を優先します。

---

## 9. ログの確認方法

- 管理画面 `/admin` → 収集履歴（実行日時／状態／候補数／公開数／重複除外／無効URL／失敗情報源／エラー／処理時間）。
- 生データ: `data/db.json` の `logs`（直近100件）。`status` は `running | success | partial_success | failed`。
- 一部の情報源のみ失敗した場合は `partial_success` として記録されます。

---

## 10. リンク切れ記事の確認方法

- 定期確認: `.github/workflows/recheck.yml`（毎日 08:30 JST）が公開済み記事を再検証。
  - 公開7日以内=毎日 / 8〜30日=週1 / 31日以上=月1（`scripts/recheck.ts`）。
  - 404/410 が継続した記事は自動的に**非公開**にしてフィードから除外します。**別URLをAIで推測して差し替えることはしません。**
- 手動: `npm run recheck`。
- 個別確認: `/admin` → 記事検証 → 「URL再確認」。ブックマーク済み記事はカードに「リンク切れ」を表示します。

---

## 11. 本番デプロイ方法

1. リポジトリを GitHub に push。
2. GitHub Secrets に `GEMINI_API_KEY` 等を設定（任意）。
3. `collect-news` ワークフローが毎朝自動実行し、`data/` を更新コミット。
4. フロントエンドは Vercel 等へデプロイ（`vercel.json` 同梱）。環境変数 `USE_MOCK_DATA=false` を設定。
   - Vercel の場合: Import Project → Environment Variables に `USE_MOCK_DATA=false`, `APP_TIMEZONE=Asia/Tokyo` を追加。
5. 静的配信のみで良い場合は `public/data/feed.json` を読む構成にも拡張可能です。

---

## 12. モックデータと本番データの切替方法

- 開発時のみ `USE_MOCK_DATA=true`（かつ `NODE_ENV!=production`）でサンプル記事を表示。
  サンプルは必ず先頭に **「開発用サンプル」** ラベルが付き、`reliabilityScore` が最低値です。
- **本番では `USE_MOCK_DATA=false` 必須。** `npm run build` は `scripts/guard-mock.js` を実行し、
  本番で `USE_MOCK_DATA=true` の場合は**ビルドを失敗**させます（spec §19）。
- 本番フィード（`/api/news`）はモックを一切読み込みません。

---

## ディレクトリ構成（主要）

```
config/sources.json          情報源設定（種別・カテゴリ・有効/無効・信頼度）
src/lib/db.ts                ファイルDB（記事/情報源/ログ/メタ/設定）
src/lib/collector/
  fetchFeed.ts               RSS/Atom/API取得
  validateUrl.ts             実HTTPによるURL検証（リダイレクト/404/トップ/検索/本文抽出）
  summarize.ts               要約（LLM or 抽出。捏造なし）
  categorize.ts              カテゴリ分類・タグ付与
  dedup.ts                   重複排除（URL/canonical/ハッシュ/類似度）
  pipeline.ts                収集20手順のオーケストレーション
  time.ts                    JST(+09:00)ユーティリティ
scripts/collect.ts           収集ジョブ本体（cron/手動）
scripts/recheck.ts           リンク切れ再確認
scripts/seed.ts              情報源シード
scripts/guard-mock.js        本番モック混入ガード
src/app/                     フロント（page.tsx / admin / api）
.github/workflows/           collect.yml（毎朝5時JST）/ recheck.yml
tests/                       ユニット＋ローカル統合テスト
```

## テスト

```bash
npm test                        # ユニット（URL正規化/重複排除/JST/検証分類）
node tests/run-integration.mjs  # ローカル擬似サイトに対する収集の統合テスト
```
