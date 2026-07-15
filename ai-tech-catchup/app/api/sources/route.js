import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db.js";
import { serializeSource } from "@/lib/serialize.js";

export async function GET() {
  const rows = db.prepare("SELECT * FROM sources ORDER BY track_type, name").all();
  return NextResponse.json({ sources: rows.map(serializeSource) });
}

export async function POST(request) {
  const body = await request.json();
  const { name, url, trackType, fetchMethod } = body;

  if (!name || !url || !["trend", "practice"].includes(trackType)) {
    return NextResponse.json(
      { error: "name, url, trackType(trend|practice) は必須です" },
      { status: 400 }
    );
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO sources (name, url, track_type, fetch_method, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(name, url, trackType, fetchMethod || "rss", nowIso(), nowIso());
    const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ source: serializeSource(row) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 400 });
  }
}
