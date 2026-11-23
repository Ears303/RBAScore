import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

type ClassIn = string | { name?: unknown; num_cards?: unknown };

export async function POST(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const defaultCards = Number(body.default_cards ?? 2);

  const specs = (Array.isArray(body.classes) ? (body.classes as ClassIn[]) : [])
    .map((c) =>
      typeof c === "string"
        ? { name: c.trim(), num_cards: defaultCards }
        : { name: String(c?.name ?? "").trim(), num_cards: Number(c?.num_cards ?? defaultCards) }
    )
    .filter((c) => c.name);

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (specs.length < 1 || specs.length > 6) {
    return NextResponse.json({ error: "Give 1 to 6 classes" }, { status: 400 });
  }
  if (new Set(specs.map((c) => c.name.toLowerCase())).size !== specs.length) {
    return NextResponse.json({ error: "Class names must be different" }, { status: 400 });
  }
  if (specs.some((c) => !Number.isInteger(c.num_cards) || c.num_cards < 1 || c.num_cards > 30)) {
    return NextResponse.json({ error: "Cards per class must be 1 to 30" }, { status: 400 });
  }

  const db = admin();
  const { data: match, error } = await db
    .from("matches")
    .insert({ name, match_date: body.match_date || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: classes, error: cErr } = await db
    .from("classes")
    .insert(specs.map((c, i) => ({ match_id: match.id, name: c.name, num_cards: c.num_cards, sort_order: i })))
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
