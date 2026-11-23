import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Aggregate, Entry, Match, MatchData, RbaClass } from "./types";

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

/** Classes, aggregates and entries (with all their card scores) for one match. */
export async function loadMatchData(matchId: string): Promise<MatchData> {
  const [c, a, e] = await Promise.all([
    sb().from("classes").select("*").eq("match_id", matchId).order("sort_order"),
    sb().from("aggregates").select("*").eq("match_id", matchId).order("created_at"),
    sb().from("entries").select("*, card_scores(*)").eq("match_id", matchId).order("entry_number"),
  ]);
  for (const r of [c, a, e]) if (r.error) throw new Error(r.error.message);
  return {
    classes: (c.data ?? []) as RbaClass[],
    aggregates: (a.data ?? []) as Aggregate[],
    entries: (e.data ?? []) as Entry[],
  };
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
