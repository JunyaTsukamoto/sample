import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { serializeArticle } from "@/lib/serialize.js";
import { recordFeedback } from "@/lib/preferences.js";

// 要件 4.4: 👍/👎 フィードバックを受け取り、即時除外ではなくEMAで好みスコアを段階的に更新する。
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const value = body?.value;

  if (value !== 1 && value !== -1) {
    return NextResponse.json(
      { error: "value must be 1 (もっと見たい) or -1 (あまり興味ない)" },
      { status: 400 }
    );
  }

  const row = db.prepare("SELECT * FROM articles WHERE id = ?").get(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const article = serializeArticle(row);
  const updatedPreferences = recordFeedback(article, value);

  return NextResponse.json({ ok: true, updatedPreferences });
}
