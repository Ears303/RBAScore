import { NextResponse } from "next/server";
import { admin, guard } from "@/lib/server";

export const dynamic = "force-dynamic";

// entry_number is optional: when blank the next free number in the match is assigned.
// membership_number (WASRA) is optional: when blank an existing one is kept.
type RowIn = {
  entry_number?: number | string | null;
  name: string;
  membership_number?: string | null;
};

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

// Membership numbers live in rba.entry_members; say so plainly if that table has not been created yet.
const friendly = (msg: string) =>
  msg.includes("entry_members") || msg.includes("membership_number")
    ? "The database is missing the entry_members table. Run the membership SQL from the chat in the Supabase SQL editor, then try again."
    : msg;

/** Admin only: entries including the private membership numbers. */
export async function GET(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const matchId = new URL(req.url).searchParams.get("match_id");
  if (!matchId) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const db = admin();
  const { data: entries, error } = await db
    .from("entries")
    .select("id, entry_number, name")
    .eq("match_id", matchId)
    .order("entry_number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (entries ?? []).map((e: { id: string }) => e.id);
  const members = new Map<string, string>();
  if (ids.length) {
    const { data: m, error: mErr } = await db
      .from("entry_members")
      .select("entry_id, membership_number")
      .in("entry_id", ids);
    if (mErr) return NextResponse.json({ error: friendly(mErr.message) }, { status: 500 });
    for (const r of (m ?? []) as { entry_id: string; membership_number: string }[]) {
      members.set(r.entry_id, r.membership_number);
    }
  }

  return NextResponse.json({
    ok: true,
    entries: (entries ?? []).map((e: { id: string; entry_number: number; name: string }) => ({
      ...e,
      membership_number: members.get(e.id) ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
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

  const clean: { match_id: string; entry_number: number; name: string }[] = [];
  const memberByNumber = new Map<number, string>();
  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    const num = isBlank(r.entry_number) ? ++highest : Number(r.entry_number);
    if (!Number.isInteger(num) || num < 0 || !name) {
      return NextResponse.json({ error: `Bad row: ${JSON.stringify(r)}` }, { status: 400 });
    }
    clean.push({ match_id: matchId, entry_number: num, name });
    if (!isBlank(r.membership_number)) {
      memberByNumber.set(num, String(r.membership_number).trim().slice(0, 40));
    }
  }

  const { data, error } = await db
    .from("entries")
    .upsert(clean, { onConflict: "match_id,entry_number" })
    .select("id, entry_number, name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only rows with a membership number touch entry_members, so a blank never wipes a saved one.
  const members = (data ?? [])
    .filter((e: { entry_number: number }) => memberByNumber.has(e.entry_number))
    .map((e: { id: string; entry_number: number }) => ({
      entry_id: e.id,
      membership_number: memberByNumber.get(e.entry_number)!,
    }));
  if (members.length) {
    const { error: mErr } = await db
      .from("entry_members")
      .upsert(members, { onConflict: "entry_id" });
    if (mErr) {
      return NextResponse.json(
        { error: `Entry saved, but the membership number was not: ${friendly(mErr.message)}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    count: clean.length,
    entries: (data ?? []).map((e: { entry_number: number; name: string }) => ({
      entry_number: e.entry_number,
      name: e.name,
    })),
  });
}

export async function DELETE(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
