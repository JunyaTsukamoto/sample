import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { serializeArticle } from "@/lib/serialize.js";

export async function GET(request, { params }) {
  const { id } = await params;
  const row = db
    .prepare(
      `SELECT articles.*, sources.name AS source_name
       FROM articles LEFT JOIN sources ON sources.id = articles.source_id
       WHERE articles.id = ?`
    )
    .get(id);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ article: serializeArticle(row) });
}
