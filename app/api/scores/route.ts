import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

type CardIn = {
  card_number: number;
  score: number | null;
  first_miss: number | null;
  notes: string | null;
};

const isInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

export async function POST(req: Request) {
  if (!authorised(req, "scorer")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  let body: { entry_id?: string; cards?: CardIn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { entry_id, cards } = body;
  if (!entry_id || !Array.isArray(cards)) {
    return NextResponse.json({ error: "entry_id and cards required" }, { status: 400 });
  }

  const upserts: object[] = [];
  const clears: number[] = [];

  for (const c of cards) {
    if (!isInt(c.card_number) || c.card_number < 1) {
      return NextResponse.json({ error: "Bad card number" }, { status: 400 });
    }
    if (c.score === null || c.score === undefined) {
      clears.push(c.card_number);
      continue;
    }
    if (!isInt(c.score) || c.score < 0 || c.score > 25) {
      return NextResponse.json(
        { error: `Card ${c.card_number}: score must be 0 to 25` },
        { status: 400 }
      );
    }
    if (
      c.first_miss !== null &&
      c.first_miss !== undefined &&
      (!isInt(c.first_miss) || c.first_miss < 1 || c.first_miss > 25)
    ) {
      return NextResponse.json(
        { error: `Card ${c.card_number}: first miss must be 1 to 25` },
        { status: 400 }
      );
    }
    upserts.push({
      entry_id,
      card_number: c.card_number,
      score: c.score,
      first_miss: c.first_miss ?? null,
      notes: c.notes?.trim() ? c.notes.trim().slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    });
  }

  const db = admin();

  if (upserts.length) {
    const { error } = await db
      .from("card_scores")
      .upsert(upserts, { onConflict: "entry_id,card_number" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (clears.length) {
    const { error } = await db
      .from("card_scores")
      .delete()
      .eq("entry_id", entry_id)
      .in("card_number", clears);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
