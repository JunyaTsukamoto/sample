import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getLatestRuns } from "@/lib/batch.js";

export async function GET() {
  const runs = getLatestRuns(20);
  const counts = db
    .prepare(
      `SELECT llm_process_status AS status, COUNT(*) AS c FROM articles GROUP BY llm_process_status`
    )
    .all();
  const totalArticles = db.prepare("SELECT COUNT(*) AS c FROM articles").get().c;

  return NextResponse.json({ runs, statusCounts: counts, totalArticles });
}
