import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db.js";
import { serializeSource } from "@/lib/serialize.js";
import { CATEGORIES } from "@/lib/categories.js";

export async function GET() {
  const rows = db.prepare("SELECT * FROM sources ORDER BY default_category, name").all();
  return NextResponse.json({ sources: rows.map(serializeSource) });
}

export async function POST(request) {
  const body = await request.json();
  const { name, url, defaultCategory } = body;
  const validCategory = CATEGORIES.some((c) => c.id === defaultCategory);

  if (!name || !url || !validCategory) {
    return NextResponse.json(
      { error: `name, url, defaultCategory(${CATEGORIES.map((c) => c.id).join("|")}) は必須です` },
      { status: 400 }
    );
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO sources (name, url, default_category, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      .run(name, url, defaultCategory, nowIso(), nowIso());
    const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ source: serializeSource(row) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 400 });
  }
}
