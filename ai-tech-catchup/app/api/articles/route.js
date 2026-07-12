import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { serializeArticle } from "@/lib/serialize.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track"); // 'trend' | 'practice' | null(=all)
  const category = searchParams.get("category");
  const crossDomain = searchParams.get("crossDomain"); // '1' to filter only cross-domain
  const limit = Math.min(Number(searchParams.get("limit") || 100), 300);
  const offset = Number(searchParams.get("offset") || 0);

  let sql = `
    SELECT articles.*, sources.name AS source_name
    FROM articles
    LEFT JOIN sources ON sources.id = articles.source_id
    WHERE articles.is_duplicate = 0
  `;
  const params = [];

  if (track === "trend" || track === "practice") {
    sql += " AND articles.track_type = ?";
    params.push(track);
  }
  if (category) {
    sql += " AND articles.categories LIKE ?";
    params.push(`%"${category}"%`);
  }
  if (crossDomain === "1") {
    sql += " AND articles.cross_domain_tags LIKE ?";
    params.push(`%disaster_abm_gis%`);
  }

  sql += " ORDER BY COALESCE(articles.published_at, articles.fetched_at) DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  const articles = rows.map(serializeArticle);

  return NextResponse.json({ articles, count: articles.length });
}
