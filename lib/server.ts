import { createClient } from "@supabase/supabase-js";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "rba" },
  });
}

export function authorised(req: Request, role: "scorer" | "admin") {
  const pin = req.headers.get("x-pin") ?? "";
  const adminPin = process.env.ADMIN_PIN;
  const scorerPin = process.env.SCORER_PIN;
  if (role === "admin") return !!adminPin && pin === adminPin;
  return (!!scorerPin && pin === scorerPin) || (!!adminPin && pin === adminPin);
}
