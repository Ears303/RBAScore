import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Entry, Match } from "./types";

type RbaClient = SupabaseClient<any, "rba", "rba">;
let client: RbaClient | null = null;

// Created lazily so the build does not need the env vars.
export function sb(): RbaClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: "rba" } }
    );
  }
  return client;
}

export async function loadMatches(): Promise<Match[]> {
  const { data, error } = await sb()
    .from("matches")
    .select("*")
    .order("match_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Match[];
}

export async function loadEntries(matchId: string): Promise<Entry[]> {
  const { data, error } = await sb()
    .from("entries")
    .select("*, card_scores(*)")
    .eq("match_id", matchId)
    .order("entry_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as Entry[];
}

export async function api(
  path: string,
  pin: string,
  body?: unknown,
  method = "POST"
) {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json", "x-pin": pin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
