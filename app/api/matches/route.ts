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
  const classNames: string[] = Array.isArray(body.classes)
    ? body.classes.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!Number.isInteger(numCards) || numCards < 1 || numCards > 30) {
    return NextResponse.json({ error: "Cards must be 1 to 30" }, { status: 400 });
  }
  if (classNames.length < 1 || classNames.length > 6) {
    return NextResponse.json({ error: "Give 1 to 6 classes" }, { status: 400 });
  }
  if (new Set(classNames.map((c) => c.toLowerCase())).size !== classNames.length) {
    return NextResponse.json({ error: "Class names must be different" }, { status: 400 });
  }

  const db = admin();
  const { data: match, error } = await db
    .from("matches")
    .insert({ name, match_date: body.match_date || null, num_cards: numCards })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: classes, error: cErr } = await db
    .from("classes")
    .insert(classNames.map((n, i) => ({ match_id: match.id, name: n, sort_order: i })))
    .select()
    .order("sort_order");
  if (cErr || !classes) {
    await db.from("matches").delete().eq("id", match.id);
    return NextResponse.json({ error: cErr?.message ?? "Could not add classes" }, { status: 500 });
  }

  // Default aggregates (changeable on the admin page):
  //  - 3 classes -> "3 Gun Agg" of all three
  //  - "2 Gun Agg" is the Light + Heavy classes (found by name); with other names it is the first two classes
  const list = classes as { id: string; name: string }[];
  const ids = list.map((c) => c.id);
  const light = list.find((c) => /light/i.test(c.name));
  const heavy = list.find((c) => /heavy/i.test(c.name));
  const twoGun = light && heavy ? [light.id, heavy.id] : ids.slice(0, 2);
  const aggs: { match_id: string; name: string; class_ids: string[] }[] = [];
  if (ids.length === 3) aggs.push({ match_id: match.id, name: "3 Gun Agg", class_ids: ids });
  if (ids.length === 2 || ids.length === 3) {
    aggs.push({ match_id: match.id, name: "2 Gun Agg", class_ids: twoGun });
  }
  if (aggs.length) await db.from("aggregates").insert(aggs);

  return NextResponse.json({ ok: true, match });
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
