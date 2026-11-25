import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "rba" },
  });
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function pinOk(req: Request, role: "scorer" | "admin") {
  const pin = req.headers.get("x-pin") ?? "";
  const adminPin = process.env.ADMIN_PIN;
  const scorerPin = process.env.SCORER_PIN;
  if (adminPin && same(pin, adminPin)) return true; // the admin PIN works everywhere
  return role === "scorer" && !!scorerPin && same(pin, scorerPin);
}

/** True when the request carries the admin PIN (used by the single sign-in page). */
export function isAdminPin(req: Request) {
  const pin = req.headers.get("x-pin") ?? "";
  const adminPin = process.env.ADMIN_PIN;
  return !!adminPin && same(pin, adminPin);
}

const WINDOW_MINUTES = 15;
const MAX_WRONG = 8; // wrong PINs allowed per address in the window

/**
 * Every protected route calls this first. Returns a response to send back (wrong PIN, or locked
 * out), or null when the caller may carry on.
 *
 * Wrong PINs are counted per address. After MAX_WRONG in WINDOW_MINUTES that address is locked out,
 * even for the right PIN, so a PIN cannot be guessed. If the attempts table has not been created yet
 * the lockout is skipped (the PIN check still applies).
 */
export async function guard(
  req: Request,
  role: "scorer" | "admin"
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const db = admin();

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await db
    .from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  const tracking = !error;

  if (tracking && (count ?? 0) >= MAX_WRONG) {
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  if (pinOk(req, role)) return null;

  if (tracking) {
    await db.from("pin_attempts").insert({ ip });
    // keep the table small
    await db
      .from("pin_attempts")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  }
  return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
}
