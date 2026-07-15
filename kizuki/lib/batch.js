import { db, nowIso } from "./db.js";
import { collectAll } from "./collect.js";
import { summarizePending } from "./summarize.js";
import { recomputeTrendScores } from "./trend.js";

/**
 * 収集→要約→トレンドスコア再計算のバッチ処理を実行し、batch_runsテーブルに記録する。
 */
export async function runBatch() {
  const insertRun = db.prepare(
    `INSERT INTO batch_runs (started_at, status) VALUES (@ts, 'running')`
  );
  const startResult = insertRun.run({ ts: nowIso() });
  const runId = startResult.lastInsertRowid;

  const finish = db.prepare(`
    UPDATE batch_runs SET
      finished_at = @ts, status = @status, fetched_count = @fetched_count,
      new_count = @new_count, summarized_count = @summarized_count,
      failed_count = @failed_count, error_message = @error_message
    WHERE id = @id
  `);

  try {
    const collectResult = await collectAll();
    const summarizeResult = await summarizePending();
    const trendResult = recomputeTrendScores();

    const status =
      collectResult.sourcesFailed > 0 && collectResult.sourcesOk === 0
        ? "failed"
        : "success";

    const combinedErrors = [...collectResult.errors, ...(summarizeResult.errors || [])];
    finish.run({
      id: runId,
      ts: nowIso(),
      status,
      fetched_count: collectResult.fetched,
      new_count: collectResult.inserted,
      summarized_count: summarizeResult.done,
      failed_count: summarizeResult.failed,
      error_message: combinedErrors.length ? combinedErrors.join(" | ").slice(0, 2000) : null,
    });

    return { runId, collectResult, summarizeResult, trendResult };
  } catch (err) {
    finish.run({
      id: runId,
      ts: nowIso(),
      status: "failed",
      fetched_count: 0,
      new_count: 0,
      summarized_count: 0,
      failed_count: 0,
      error_message: String(err.message || err).slice(0, 2000),
    });
    throw err;
  }
}

export function getLatestRuns(limit = 10) {
  return db.prepare("SELECT * FROM batch_runs ORDER BY id DESC LIMIT ?").all(limit);
}
