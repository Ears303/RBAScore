import { NextResponse } from "next/server";
import { admin, authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const matchId = body.match_id as string | undefined;
  const name = String(body.name ?? "").trim();
  const classIds: string[] = Array.isArray(body.class_ids) ? body.class_ids : [];
  if (!matchId || !name) {
    return NextResponse.json({ error: "match_id and name required" }, { status: 400 });
  }
  if (classIds.length < 2) {
    return NextResponse.json({ error: "Pick at least two classes" }, { status: 400 });
  }

  const db = admin();
  const { data: classes, error: cErr } = await db
    .from("classes")
    .select("id")
    .eq("match_id", matchId);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  const valid = new Set((classes ?? []).map((c: { id: string }) => c.id));
  if (!classIds.every((id) => valid.has(id))) {
    return NextResponse.json({ error: "Class does not belong to this match" }, { status: 400 });
  }

  const { error } = await db
    .from("aggregates")
    .insert({ match_id: matchId, name, class_ids: classIds });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!authorised(req, "admin")) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("aggregates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
