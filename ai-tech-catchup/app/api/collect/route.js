import { NextResponse } from "next/server";
import { runBatch } from "@/lib/batch.js";

// 手動再収集トリガー (要件 F-12)。RSS取得+LLM要約をまとめて実行する。
export async function POST() {
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
