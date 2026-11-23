import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

// entry_number is optional: when blank the next free number in the match is assigned.
// membership_number (WASRA) is optional: when blank an existing one is kept.
type RowIn = {
  entry_number?: number | string | null;
  name: string;
  membership_number?: string | null;
};

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/** Admin only: entries including the private membership numbers. */
export async function GET(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const matchId = new URL(req.url).searchParams.get("match_id");
  if (!matchId) return NextResponse.json({ error: "match_id required" }, { status: 400 });
  const { data, error } = await admin()
    .from("entries")
    .select("id, entry_number, name, membership_number")
    .eq("match_id", matchId)
    .order("entry_number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entries: data });
}

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

  const clean: {
    match_id: string;
    entry_number: number;
    name: string;
    membership_number: string | null;
  }[] = [];
  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    const num = isBlank(r.entry_number) ? ++highest : Number(r.entry_number);
    if (!Number.isInteger(num) || num < 0 || !name) {
      return NextResponse.json({ error: `Bad row: ${JSON.stringify(r)}` }, { status: 400 });
    }
    clean.push({
      match_id: matchId,
      entry_number: num,
      name,
      membership_number: isBlank(r.membership_number)
        ? null
        : String(r.membership_number).trim().slice(0, 40),
    });
  }

  // A blank membership number must not wipe one that is already saved for that entry.
  const { data: existing } = await db
    .from("entries")
    .select("entry_number, membership_number")
    .eq("match_id", matchId)
    .in("entry_number", clean.map((c) => c.entry_number));
  const saved = new Map(
    (existing ?? []).map((e: { entry_number: number; membership_number: string | null }) => [
      e.entry_number,
      e.membership_number,
    ])
  );
  for (const c of clean) {
    if (c.membership_number === null) c.membership_number = saved.get(c.entry_number) ?? null;
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
