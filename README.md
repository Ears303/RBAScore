# RBA Scoring

Next.js app for Vercel with a Supabase back end.

- `/` public scoreboard. One tab per class plus a tab per aggregate (e.g. 2 Gun Agg, 3 Gun Agg). Ranked, per-card scores, first miss, notes marker, total, and tap a row to see every shot. The decimals of a score are the X count. Auto-refreshes every 15 seconds.
- `/score` score entry (PIN). Find a shooter by name or entry number, then enter each card's 25 shots one at a time (0 to 10, or `X` which counts 10.01), plus first miss shot number and notes. A card maxes at 250.25. Card and match totals update as you type. Typing moves to the next shot automatically (type `1` then `0` for a 10), and you can paste a whole card like `10 X X 9 8 ...`.
- `/admin` (PIN) create matches (the classes shot and cards in each), manage aggregates, add entries one at a time or paste a list.

## Classes and aggregates

Each class has its own number of cards (for example Sporter 3, Light 2, Heavy 2), set when you create the match as `Sporter:3, Light:2, Heavy:2` and editable later on the admin page. A competitor has one entry number per match and can shoot up to three classes (or more if the match has more). Scores are entered per class on the score entry page. Each class has its own board. An aggregate is the sum of the classes it lists, and a competitor shows on it once they have scores in every one of those classes. A match with the classes Sporter, Light and Heavy gets "3 Gun Agg" (all three) and "2 Gun Agg" (Light + Heavy) automatically; change them on the admin page.

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

- `matches`: name, date
- `classes`: the classes shot at a match, each with its number of cards
- `aggregates`: named sums of classes (2 Gun Agg, 3 Gun Agg)
- `entries`: entry number (unique per match), name
- `card_scores`: one row per entry per class per card with the shots (array of up to 25 values, 10.01 = X), card score (max 250.25, calculated by the API), first miss (1 to 25 or blank), notes

If you already ran an earlier version of `schema.sql` (before shot-by-shot entry), run `drop schema rba cascade;` first, then run the current file. Nothing is lost if no scores were entered yet.
