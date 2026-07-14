import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db.js";
import { serializeArticle } from "@/lib/serialize.js";

// 要件 4.6: 記事単位のブックマーク登録・解除
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bookmarked = body?.bookmarked !== false;

  const row = db.prepare("SELECT * FROM articles WHERE id = ?").get(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  db.prepare("UPDATE articles SET bookmarked_at = ?, updated_at = ? WHERE id = ?").run(
    bookmarked ? nowIso() : null,
    nowIso(),
    id
  );

  const updated = db
    .prepare(
      `SELECT articles.*, sources.name AS source_name
       FROM articles LEFT JOIN sources ON sources.id = articles.source_id
       WHERE articles.id = ?`
    )
    .get(id);

  return NextResponse.json({ ok: true, article: serializeArticle(updated) });
}
