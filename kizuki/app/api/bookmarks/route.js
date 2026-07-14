import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { serializeArticle } from "@/lib/serialize.js";

// 要件 4.6: ブックマーク一覧
export async function GET() {
  const rows = db
    .prepare(
      `SELECT articles.*, sources.name AS source_name
       FROM articles
       LEFT JOIN sources ON sources.id = articles.source_id
       WHERE articles.bookmarked_at IS NOT NULL
       ORDER BY articles.bookmarked_at DESC`
    )
    .all();

  return NextResponse.json({ articles: rows.map(serializeArticle) });
}
