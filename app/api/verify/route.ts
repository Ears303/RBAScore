import { NextResponse } from "next/server";
import { guard } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role =
    new URL(req.url).searchParams.get("role") === "admin" ? "admin" : "scorer";
  const denied = await guard(req, role);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
