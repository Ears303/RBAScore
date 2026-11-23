import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

type RowIn = { entry_number: number; name: string };

export async function POST(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const matchId = body.match_id as string | undefined;
  const rows = body.rows as RowIn[] | undefined;
  if (!matchId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "match_id and rows required" }, { status: 400 });
  }

  const clean = [];
  for (const r of rows) {
    const num = Number(r.entry_number);
    const name = String(r.name ?? "").trim();
    if (!Number.isInteger(num) || num < 0 || !name) {
      return NextResponse.json(
        { error: `Bad row: ${JSON.stringify(r)}` },
        { status: 400 }
      );
    }
    clean.push({ match_id: matchId, entry_number: num, name });
  }

  const { error } = await admin()
    .from("entries")
    .upsert(clean, { onConflict: "match_id,entry_number" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: clean.length });
}

export async function DELETE(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
