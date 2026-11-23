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
  if (!matchId || !name) {
    return NextResponse.json({ error: "match_id and name required" }, { status: 400 });
  }
  const db = admin();
  const { count } = await db
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  const { error } = await db
    .from("classes")
    .insert({ match_id: matchId, name, sort_order: count ?? 0 });
  if (error) {
    const dup = error.message.includes("duplicate");
    return NextResponse.json(
      { error: dup ? "That class already exists" : error.message },
      { status: dup ? 400 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
