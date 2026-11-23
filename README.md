# RBA Scoring

Next.js app for Vercel with a Supabase back end.

- `/` public scoreboard (ranked, per-card scores, first miss, notes marker, total). Auto-refreshes every 15 seconds.
- `/score` score entry (PIN). Find a shooter by name or entry number, enter each card's score (0 to 25), first miss shot number and notes. Total updates as you type.
- `/admin` (PIN) create matches (set number of cards), add entries one at a time or paste a list.

## Setup

1. **Supabase** (use your existing project): open the SQL editor and run `supabase/schema.sql`. It creates everything in a separate `rba` schema. Then go to Project Settings, API, and add `rba` to **Exposed schemas**.
2. **Env vars**: copy `.env.example` to `.env.local` and fill in the values (Supabase URL, anon key, service role key, and two PINs).
3. **Run locally**: `npm install` then `npm run dev`.
4. **Deploy**: push to GitHub, import into Vercel, and add the same five env vars in Project Settings, Environment Variables.

## How security works

The scoreboard reads directly from Supabase using the anon key. Row level security only allows `select`, so nobody can write with that key. All writes go through the API routes in `app/api`, which check the PIN and then use the service role key on the server. Keep `SUPABASE_SERVICE_ROLE_KEY` out of any `NEXT_PUBLIC_` variable.

`SCORER_PIN` can enter scores. `ADMIN_PIN` can also create matches and entries.

## Data model

All tables are in the `rba` schema:

- `matches`: name, date, number of cards
- `entries`: entry number (unique per match), name, class
- `card_scores`: one row per entry per card with score (0 to 25), first miss (1 to 25 or blank), notes
