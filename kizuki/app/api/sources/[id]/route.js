import { NextResponse } from "next/server";
import { db, nowIso } from "@/lib/db.js";
import { serializeSource } from "@/lib/serialize.js";

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const existing = db.prepare("SELECT * FROM sources WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const next = {
    name: body.name ?? existing.name,
    url: body.url ?? existing.url,
    default_category: body.defaultCategory ?? existing.default_category,
    is_active:
      typeof body.isActive === "boolean" ? (body.isActive ? 1 : 0) : existing.is_active,
  };

  db.prepare(
    `UPDATE sources SET name=@name, url=@url, default_category=@default_category,
     is_active=@is_active, updated_at=@ts WHERE id=@id`
  ).run({ ...next, ts: nowIso(), id });

  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id);
  return NextResponse.json({ source: serializeSource(row) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
