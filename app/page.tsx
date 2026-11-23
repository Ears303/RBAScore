"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadEntries, loadMatches } from "@/lib/client";
import { cardOf, totalOf, type Entry, type Match } from "@/lib/types";

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [cls, setCls] = useState("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    loadMatches()
      .then((m) => {
        setMatches(m);
        if (m[0]) setMatchId(m[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    try {
      setEntries(await loadEntries(matchId));
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [matchId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const match = matches.find((m) => m.id === matchId);
  const numCards = match?.num_cards ?? 5;

  const classes = useMemo(
    () => ["All", ...Array.from(new Set(entries.map((e) => e.class).filter(Boolean) as string[])).sort()],
    [entries]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = entries.filter(
      (e) =>
        (cls === "All" || e.class === cls) &&
        (!needle ||
          e.name.toLowerCase().includes(needle) ||
          String(e.entry_number) === needle)
    );
    const scored = filtered
      .filter((e) => e.card_scores.length > 0)
      .sort((a, b) => totalOf(b) - totalOf(a) || a.entry_number - b.entry_number);
    const unscored = filtered
      .filter((e) => e.card_scores.length === 0)
      .sort((a, b) => a.entry_number - b.entry_number);
    const totals = scored.map(totalOf);
    return {
      scored: scored.map((e) => ({
        e,
        rank: 1 + totals.filter((t) => t > totalOf(e)).length,
        tied: totals.filter((t) => t === totalOf(e)).length > 1,
      })),
      unscored,
    };
  }, [entries, cls, q]);

  return (
    <>
      <h1>Scoreboard</h1>

      <div className="panel">
        <div className="row">
          <div>
            <label htmlFor="match">Match</label>
            <select id="match" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              {matches.length === 0 && <option value="">No matches yet</option>}
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.match_date ? ` (${m.match_date})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cls">Class</label>
            <select id="cls" value={cls} onChange={(e) => setCls(e.target.value)}>
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q">Find name or entry number</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <p className="muted small" style={{ margin: "12px 0 0" }}>
          {updated ? `Updated ${updated.toLocaleTimeString()}. ` : ""}
          Refreshes automatically. Small figure under a score is the first miss shot number.
        </p>
      </div>

      {error && <div className="msg err">{error}</div>}

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">Rank</th>
              <th className="num">#</th>
              <th>Name</th>
              <th>Class</th>
              {Array.from({ length: numCards }, (_, i) => (
                <th key={i} className="num">C{i + 1}</th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.scored.map(({ e, rank, tied }) => (
              <Row key={e.id} e={e} numCards={numCards} rank={`${rank}${tied ? "=" : ""}`} />
            ))}
            {rows.unscored.map((e) => (
              <Row key={e.id} e={e} numCards={numCards} rank="–" />
            ))}
            {rows.scored.length + rows.unscored.length === 0 && (
              <tr>
                <td colSpan={numCards + 5} className="muted">
                  No entries to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ e, numCards, rank }: { e: Entry; numCards: number; rank: string }) {
  const has = e.card_scores.length > 0;
  return (
    <tr>
      <td className="num">{rank}</td>
      <td className="num">{e.entry_number}</td>
      <td>{e.name}</td>
      <td className="muted">{e.class ?? ""}</td>
      {Array.from({ length: numCards }, (_, i) => {
        const c = cardOf(e, i + 1);
        return (
          <td key={i} className="num">
            {c ? (
              <>
                {c.score}
                {c.notes && (
                  <span className="note-dot" title={c.notes}>
                    {" "}•
                  </span>
                )}
                {c.first_miss != null && <span className="fm">fm {c.first_miss}</span>}
              </>
            ) : (
              <span className="muted">–</span>
            )}
          </td>
        );
      })}
      <td className="total">{has ? totalOf(e) : "–"}</td>
    </tr>
  );
}
