import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getLatestRuns } from "@/lib/batch.js";

// トップ画面の「最終更新: YYYY/MM/DD・N件の兆し」表示に使う情報を返す。
export async function GET() {
  const runs = getLatestRuns(20);
  const counts = db
    .prepare(
      `SELECT llm_process_status AS status, COUNT(*) AS c FROM articles GROUP BY llm_process_status`
    )
    .all();
  const activeCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM articles WHERE llm_process_status = 'done' AND is_duplicate = 0`
    )
    .get().c;
  const totalArticles = db.prepare("SELECT COUNT(*) AS c FROM articles").get().c;
  const lastUpdatedAt = runs.find((r) => r.status !== "running")?.finished_at ?? null;

  return NextResponse.json({
    runs,
    statusCounts: counts,
    totalArticles,
    activeCount,
    lastUpdatedAt,
  });
}
