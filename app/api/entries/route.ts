import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

// entry_number is optional: when blank the next free number in the match is assigned.
type RowIn = { entry_number?: number | string | null; name: string };

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

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

  const db = admin();

  // Highest number already used, including any explicit numbers in this batch.
  const { data: top } = await db
    .from("entries")
    .select("entry_number")
    .eq("match_id", matchId)
    .order("entry_number", { ascending: false })
    .limit(1);
  let highest = (top?.[0]?.entry_number as number | undefined) ?? 0;
  for (const r of rows) {
    if (!isBlank(r.entry_number)) highest = Math.max(highest, Number(r.entry_number) || 0);
  }

  const clean = [];
  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    const num = isBlank(r.entry_number) ? ++highest : Number(r.entry_number);
    if (!Number.isInteger(num) || num < 0 || !name) {
      return NextResponse.json({ error: `Bad row: ${JSON.stringify(r)}` }, { status: 400 });
    }
    clean.push({ match_id: matchId, entry_number: num, name });
  }

  const { data, error } = await db
    .from("entries")
    .upsert(clean, { onConflict: "match_id,entry_number" })
    .select("entry_number,name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: clean.length, entries: data });
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
