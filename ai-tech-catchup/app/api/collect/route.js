import { NextResponse } from "next/server";
import { runBatch } from "@/lib/batch.js";

const globalForCollect = globalThis;

function startBackgroundBatch() {
  if (globalForCollect.__aiTechCatchupBatchPromise) {
    return { started: false, running: true };
  }

  console.log("[collect] background batch started");
  globalForCollect.__aiTechCatchupBatchPromise = runBatch()
    .then((result) => {
      console.log(
        `[collect] background batch finished: fetched=${result.collectResult.fetched} ` +
          `new=${result.collectResult.inserted} summarized=${result.summarizeResult.done} ` +
          `failed=${result.summarizeResult.failed}`
      );
    })
    .catch((err) => {
      console.error("[collect] background batch failed:", err);
    })
    .finally(() => {
      globalForCollect.__aiTechCatchupBatchPromise = null;
    });

  return { started: true, running: false };
}

// 手動再収集トリガー (要件 F-12)。RSS取得+LLM要約をまとめて実行する。
export async function POST(request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("background") === "1") {
    const state = startBackgroundBatch();
    return NextResponse.json(
      { ok: true, mode: "background", ...state },
      { status: state.started ? 202 : 200 }
    );
  }

  try {
    const result = await runBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err.message || err) },
      { status: 500 }
    );
  }
}
