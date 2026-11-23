import { NextResponse } from "next/server";
import { admin, guard } from "@/lib/server";

export const dynamic = "force-dynamic";

type CardIn = {
  card_number: number;
  shots: number[];
  first_miss: number | null;
  notes: string | null;
};

const isInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

// A shot is a whole number 0 to 10, or 10.01 (an X).
const validShot = (v: unknown): v is number =>
  typeof v === "number" &&
  ((Number.isInteger(v) && v >= 0 && v <= 10) || Math.round(v * 100) === 1001);

export async function POST(req: Request) {
  const denied = await guard(req, "scorer");
  if (denied) return denied;

  let body: { entry_id?: string; class_id?: string; cards?: CardIn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { entry_id, class_id, cards } = body;
  if (!entry_id || !class_id || !Array.isArray(cards)) {
    return NextResponse.json(
      { error: "entry_id, class_id and cards required" },
      { status: 400 }
    );
  }

  const upserts: object[] = [];
  const clears: number[] = [];

  for (const c of cards) {
    if (!isInt(c.card_number) || c.card_number < 1) {
      return NextResponse.json({ error: "Bad card number" }, { status: 400 });
    }
    // No shots means the card is empty: remove any saved score for it.
    if (!Array.isArray(c.shots) || c.shots.length === 0) {
      clears.push(c.card_number);
      continue;
    }
    if (c.shots.length > 25) {
      return NextResponse.json(
        { error: `Card ${c.card_number}: more than 25 shots` },
        { status: 400 }
      );
    }
    if (!c.shots.every(validShot)) {
      return NextResponse.json(
        { error: `Card ${c.card_number}: each shot must be 0 to 10 or X` },
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

    // Normalise X to exactly 10.01 and compute the score on the server.
    const shots = c.shots.map((v) => (v > 10 ? 10.01 : v));
    const score = shots.reduce((sum, v) => sum + Math.round(v * 100), 0) / 100;

    upserts.push({
      entry_id,
      class_id,
      card_number: c.card_number,
      shots,
      score,
      first_miss: c.first_miss ?? null,
      notes: c.notes?.trim() ? c.notes.trim().slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    });
  }

  const db = admin();

  if (upserts.length) {
    const { error } = await db
      .from("card_scores")
      .upsert(upserts, { onConflict: "entry_id,class_id,card_number" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (clears.length) {
    const { error } = await db
      .from("card_scores")
      .delete()
      .eq("entry_id", entry_id)
      .eq("class_id", class_id)
      .in("card_number", clears);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
