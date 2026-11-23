import { NextResponse } from "next/server";
import { authorised } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role =
    new URL(req.url).searchParams.get("role") === "admin" ? "admin" : "scorer";
  if (!authorised(req, role)) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
