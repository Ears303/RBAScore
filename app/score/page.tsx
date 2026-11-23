"use client";

import { useEffect, useMemo, useState } from "react";
import PinGate from "@/components/PinGate";
import { api, loadEntries, loadMatches } from "@/lib/client";
import { cardOf, type Entry, type Match } from "@/lib/types";

type CardRow = { score: string; fm: string; notes: string };

export default function ScorePage() {
  return (
    <>
      <h1>Score entry</h1>
      <PinGate role="scorer" title="Scorer PIN">
        {(pin, lock) => <Scorer pin={pin} lock={lock} />}
      </PinGate>
    </>
  );
}

function Scorer({ pin, lock }: { pin: string; lock: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [rows, setRows] = useState<CardRow[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMatches()
      .then((m) => {
        setMatches(m);
        if (m[0]) setMatchId(m[0].id);
      })
      .catch((e) => setMsg({ kind: "err", text: e.message }));
  }, []);

  useEffect(() => {
    if (!matchId) return;
    setSelectedId("");
    setQuery("");
    loadEntries(matchId)
      .then(setEntries)
      .catch((e) => setMsg({ kind: "err", text: e.message }));
  }, [matchId]);

  const match = matches.find((m) => m.id === matchId);
  const numCards = match?.num_cards ?? 5;
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exact = /^\d+$/.test(q) ? entries.filter((e) => String(e.entry_number) === q) : [];
    const byName = entries.filter(
      (e) => e.name.toLowerCase().includes(q) && !exact.includes(e)
    );
    return [...exact, ...byName].slice(0, 8);
  }, [query, entries]);

  function select(e: Entry) {
    setSelectedId(e.id);
    setQuery("");
    setMsg(null);
    setRows(
      Array.from({ length: numCards }, (_, i) => {
        const c = cardOf(e, i + 1);
        return {
          score: c ? String(c.score) : "",
          fm: c?.first_miss != null ? String(c.first_miss) : "",
          notes: c?.notes ?? "",
        };
      })
    );
  }

  function setRow(i: number, patch: Partial<CardRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  const total = rows.reduce((s, r) => s + (r.score === "" ? 0 : Number(r.score) || 0), 0);

  async function save() {
    if (!selected) return;
    const cards = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.score === "") {
        cards.push({ card_number: i + 1, score: null, first_miss: null, notes: null });
        continue;
      }
      const score = Number(r.score);
      if (!Number.isInteger(score) || score < 0 || score > 25) {
        setMsg({ kind: "err", text: `Card ${i + 1}: score must be a whole number 0 to 25` });
        return;
      }
      let first_miss: number | null = null;
      if (r.fm !== "") {
        first_miss = Number(r.fm);
        if (!Number.isInteger(first_miss) || first_miss < 1 || first_miss > 25) {
          setMsg({ kind: "err", text: `Card ${i + 1}: first miss must be 1 to 25` });
          return;
        }
      }
      cards.push({ card_number: i + 1, score, first_miss, notes: r.notes });
    }
    setSaving(true);
    setMsg(null);
    try {
      await api("/api/scores", pin, { entry_id: selected.id, cards });
      const fresh = await loadEntries(matchId);
      setEntries(fresh);
      setMsg({ kind: "ok", text: `Saved ${selected.name} (#${selected.entry_number}), total ${total}` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
          <div style={{ flex: "2 1 260px" }}>
            <label htmlFor="find">Find by name or entry number</label>
            <input
              id="find"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) select(results[0]);
              }}
              placeholder="e.g. 12 or Donohoe"
              autoComplete="off"
            />
          </div>
          <div className="shrink">
            <button className="secondary" onClick={lock}>Lock</button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="results">
            {results.map((e) => (
              <button key={e.id} className="result" onClick={() => select(e)}>
                <span>#{e.entry_number} {e.name}</span>
                <span className="muted">{e.class ?? ""}</span>
              </button>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>No matching entry.</p>
        )}
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {selected && (
        <div className="panel">
          <div className="row" style={{ alignItems: "center" }}>
            <div>
              <h2 style={{ marginBottom: 2 }}>#{selected.entry_number} {selected.name}</h2>
              <div className="muted small">{selected.class ?? ""}</div>
            </div>
            <div className="shrink" style={{ textAlign: "right" }}>
              <div className="muted small">Total</div>
              <div className="bigtotal">{total}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="card-grid">
              <div className="head">Card</div>
              <div className="head">Score</div>
              <div className="head">1st miss</div>
              <div className="head">Notes</div>
            </div>
            {rows.map((r, i) => (
              <div className="card-grid" key={i}>
                <div className="cardno">{i + 1}</div>
                <input
                  aria-label={`Card ${i + 1} score`}
                  inputMode="numeric"
                  value={r.score}
                  onChange={(e) => setRow(i, { score: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                />
                <input
                  aria-label={`Card ${i + 1} first miss`}
                  inputMode="numeric"
                  value={r.fm}
                  onChange={(e) => setRow(i, { fm: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                />
                <input
                  aria-label={`Card ${i + 1} notes`}
                  value={r.notes}
                  onChange={(e) => setRow(i, { notes: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save scores"}</button>
            <button className="secondary" onClick={() => setSelectedId("")}>Close</button>
          </div>
          <p className="muted small">
            Leave a card's score blank if it hasn't been shot. First miss is the shot number (1 to 25) of the first miss on that card; leave blank for a clean card.
          </p>
        </div>
      )}
    </>
  );
}
