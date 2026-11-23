import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const numCards = Number(body.num_cards ?? 5);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!Number.isInteger(numCards) || numCards < 1 || numCards > 30) {
    return NextResponse.json({ error: "Cards must be 1 to 30" }, { status: 400 });
  }
  const { data, error } = await admin()
    .from("matches")
    .insert({ name, match_date: body.match_date || null, num_cards: numCards })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, match: data });
}

export async function DELETE(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("matches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
