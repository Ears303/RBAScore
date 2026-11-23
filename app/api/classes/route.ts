import { NextResponse } from "next/server";
import { admin, guard } from "@/lib/server";

export const dynamic = "force-dynamic";

const validCards = (n: number) => Number.isInteger(n) && n >= 1 && n <= 30;

export async function POST(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const matchId = body.match_id as string | undefined;
  const name = String(body.name ?? "").trim();
  const numCards = Number(body.num_cards ?? 2);
  if (!matchId || !name) {
    return NextResponse.json({ error: "match_id and name required" }, { status: 400 });
  }
  if (!validCards(numCards)) {
    return NextResponse.json({ error: "Cards must be 1 to 30" }, { status: 400 });
  }
  const db = admin();
  const { count } = await db
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  const { error } = await db
    .from("classes")
    .insert({ match_id: matchId, name, num_cards: numCards, sort_order: count ?? 0 });
  if (error) {
    const dup = error.message.includes("duplicate");
    return NextResponse.json(
      { error: dup ? "That class already exists" : error.message },
      { status: dup ? 400 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** Change how many cards a class has. Refuses to drop below a card that already has scores. */
export async function PATCH(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = body.id as string | undefined;
  const numCards = Number(body.num_cards);
  if (!id || !validCards(numCards)) {
    return NextResponse.json({ error: "id and cards (1 to 30) required" }, { status: 400 });
  }
  const db = admin();
  const { data: top } = await db
    .from("card_scores")
    .select("card_number")
    .eq("class_id", id)
    .order("card_number", { ascending: false })
    .limit(1);
  const highest = top?.[0]?.card_number as number | undefined;
  if (highest && highest > numCards) {
    return NextResponse.json(
      { error: `Card ${highest} already has scores, so this class needs at least ${highest} cards` },
      { status: 400 }
    );
  }
  const { error } = await db.from("classes").update({ num_cards: numCards }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
