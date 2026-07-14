#!/usr/bin/env node
// スタンドアロンのバッチ実行スクリプト。
// `npm run batch` または cron から `node scripts/run-batch.js` として直接実行できる。

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const envLocal = path.join(projectRoot, ".env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config({ path: path.join(projectRoot, ".env") });
}

const { runBatch } = await import("../lib/batch.js");

const startedAt = new Date().toISOString();
console.log(`[run-batch] 開始: ${startedAt}`);

try {
  const result = await runBatch();
  console.log(
    `[run-batch] 完了: 取得=${result.collectResult.fetched} 新着=${result.collectResult.inserted} ` +
      `要約完了=${result.summarizeResult.done} 要約失敗=${result.summarizeResult.failed} ` +
      `トレンド再計算=${result.trendResult.updated}件` +
      (result.summarizeResult.usingFallback
        ? " (ANTHROPIC_API_KEY未設定のため簡易要約を使用)"
        : "")
  );
  if (result.collectResult.errors.length > 0) {
    console.warn("[run-batch] ソース収集エラー:");
    for (const e of result.collectResult.errors) console.warn(`  - ${e}`);
  }
  process.exit(0);
} catch (err) {
  console.error("[run-batch] 失敗:", err);
  process.exit(1);
}
