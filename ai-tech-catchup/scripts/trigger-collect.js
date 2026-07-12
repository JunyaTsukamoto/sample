#!/usr/bin/env node
// Render等のPaaSで「Webサービス」と「Cronジョブ」が別プロセス/別コンテナに分かれる構成向け。
// Cronジョブ自体は永続ディスク(DB)にアクセスできないため、常時起動しているWebサービス側の
// /api/collect エンドポイントをHTTPで呼び出すことで、DBを持つプロセス内でバッチを実行させる。
//
// 環境変数:
//   COLLECT_URL     : 直接叩くURL（例: https://your-app.onrender.com/api/collect）
//   RENDER_WEB_URL   : render.yamlのfromServiceで自動注入されるWebサービスのホスト名。
//                      COLLECT_URLが未設定の場合、これを使って https://<host>/api/collect を組み立てる。
//
// ローカル/VPSで直接バッチを実行したい場合は、こちらではなく scripts/run-batch.js を使うこと
// （DBに直接アクセスして収集・要約を行うため、常時起動サーバーが不要）。

const collectUrl =
  process.env.COLLECT_URL ||
  (process.env.RENDER_WEB_URL
    ? `https://${process.env.RENDER_WEB_URL}/api/collect`
    : null);

if (!collectUrl) {
  console.error(
    "[trigger-collect] COLLECT_URL または RENDER_WEB_URL のいずれかを設定してください"
  );
  process.exit(1);
}

console.log(`[trigger-collect] POST ${collectUrl}`);

try {
  const res = await fetch(collectUrl, { method: "POST" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok || !data?.ok) {
    console.error(`[trigger-collect] 失敗 (status ${res.status}): ${text}`);
    process.exit(1);
  }

  console.log(
    `[trigger-collect] 完了: 新着=${data.collectResult.inserted} 要約完了=${data.summarizeResult.done} 要約失敗=${data.summarizeResult.failed}`
  );
  process.exit(0);
} catch (err) {
  console.error("[trigger-collect] リクエスト失敗:", err.message);
  process.exit(1);
}
