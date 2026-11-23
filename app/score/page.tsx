"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PinGate from "@/components/PinGate";
import { api, loadMatchData, loadMatches } from "@/lib/client";
import { applyInput, cardScore, fmt2, SHOTS, shotValue } from "@/lib/shots";
import { cardOf, emptyMatchData, type Entry, type Match, type MatchData } from "@/lib/types";

type CardRow = { shots: string[]; fm: string; notes: string };

const emptyCard = (): CardRow => ({ shots: Array(SHOTS).fill(""), fm: "", notes: "" });

const sumRows = (rows: CardRow[] | undefined) =>
  Math.round((rows ?? []).reduce((s, r) => s + Math.round(cardScore(r.shots) * 100), 0)) / 100;

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

function ShotGrid({
  shots,
  label,
  onChange,
}: {
  shots: string[];
  label: string;
  onChange: (s: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusAt = (i: number, caretEnd: boolean) =>
    setTimeout(() => {
      const el = refs.current[i];
      if (!el) return;
      el.focus();
      if (caretEnd) el.setSelectionRange(el.value.length, el.value.length);
      else el.select();
    }, 0);

  function handle(i: number, raw: string) {
    const r = applyInput(shots, i, raw);
    onChange(r.next);
    if (r.pendingOne && r.focus === i) return; // stay put, waiting for a possible 0
    focusAt(r.focus, r.pendingOne);
  }

  function keyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && shots[i] === "" && i > 0) {
      e.preventDefault();
      const next = [...shots];
      next[i - 1] = "";
      onChange(next);
      focusAt(i - 1, false);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1, false);
    } else if ((e.key === "ArrowRight" || e.key === "Enter") && i < SHOTS - 1) {
      e.preventDefault();
      focusAt(i + 1, false);
    }
  }

  return (
    <div className="shots">
      {shots.map((s, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="shot"
          aria-label={`${label} shot ${i + 1}`}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          value={s}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => handle(i, e.target.value)}
          onKeyDown={(e) => keyDown(i, e)}
        />
      ))}
    </div>
  );
}

/** Turns the entry rows for one class into API cards, or an error message. */
function buildCards(rows: CardRow[], label: string): { cards: object[] } | { error: string } {
  const cards: object[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const vals = r.shots.map(shotValue);
    let last = -1;
    vals.forEach((v, k) => {
      if (v !== null) last = k;
    });
    if (last < 0) {
      cards.push({ card_number: i + 1, shots: [], first_miss: null, notes: null });
      continue;
    }
    const trimmed = vals.slice(0, last + 1);
    const gap = trimmed.findIndex((v) => v === null || Number.isNaN(v));
    if (gap >= 0) {
      return { error: `${label} card ${i + 1}: shot ${gap + 1} is empty or invalid` };
    }
    let first_miss: number | null = null;
    if (r.fm !== "") {
      first_miss = Number(r.fm);
      if (!Number.isInteger(first_miss) || first_miss < 1 || first_miss > 25) {
        return { error: `${label} card ${i + 1}: first miss must be 1 to 25` };
      }
    }
    cards.push({ card_number: i + 1, shots: trimmed as number[], first_miss, notes: r.notes });
  }
  return { cards };
}

function Scorer({ pin, lock }: { pin: string; lock: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [classId, setClassId] = useState("");
  const [rowsByClass, setRowsByClass] = useState<Record<string, CardRow[]>>({});
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
    setData(emptyMatchData());
    loadMatchData(matchId)
      .then(setData)
      .catch((e) => setMsg({ kind: "err", text: e.message }));
  }, [matchId]);

  const match = matches.find((m) => m.id === matchId);
  const numCards = match?.num_cards ?? 5;
  const selected = data.entries.find((e) => e.id === selectedId) ?? null;
  const rows = rowsByClass[classId] ?? [];
  const currentClass = data.classes.find((c) => c.id === classId);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exact = /^\d+$/.test(q) ? data.entries.filter((e) => String(e.entry_number) === q) : [];
    const byName = data.entries.filter(
      (e) => e.name.toLowerCase().includes(q) && !exact.includes(e)
    );
    return [...exact, ...byName].slice(0, 8);
  }, [query, data.entries]);

  function select(e: Entry) {
    setSelectedId(e.id);
    setQuery("");
    setMsg(null);
    const map: Record<string, CardRow[]> = {};
    for (const cl of data.classes) {
      map[cl.id] = Array.from({ length: numCards }, (_, i) => {
        const c = cardOf(e, cl.id, i + 1);
        if (!c) return emptyCard();
        const shots = Array(SHOTS).fill("") as string[];
        (c.shots ?? []).slice(0, SHOTS).forEach((v, k) => {
          shots[k] = Number(v) > 10 ? "X" : String(Number(v));
        });
        return { shots, fm: c.first_miss != null ? String(c.first_miss) : "", notes: c.notes ?? "" };
      });
    }
    setRowsByClass(map);
    setClassId(data.classes[0]?.id ?? "");
  }

  function setRow(i: number, patch: Partial<CardRow>) {
    setRowsByClass((m) => ({
      ...m,
      [classId]: (m[classId] ?? []).map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    }));
  }

  async function save() {
    if (!selected) return;
    const toSend: { class_id: string; cards: object[] }[] = [];
    for (const cl of data.classes) {
      const built = buildCards(rowsByClass[cl.id] ?? [], cl.name);
      if ("error" in built) {
        setClassId(cl.id);
        setMsg({ kind: "err", text: built.error });
        return;
      }
      toSend.push({ class_id: cl.id, cards: built.cards });
    }
    setSaving(true);
    setMsg(null);
    try {
      for (const s of toSend) {
        await api("/api/scores", pin, { entry_id: selected.id, ...s });
      }
      setData(await loadMatchData(matchId));
      setMsg({ kind: "ok", text: `Saved ${selected.name} (#${selected.entry_number})` });
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
              </button>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>No matching entry.</p>
        )}
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {selected && currentClass && (
        <div className="panel">
          <div className="row" style={{ alignItems: "center" }}>
            <div>
              <h2 style={{ marginBottom: 2 }}>#{selected.entry_number} {selected.name}</h2>
              <div className="muted small">
                {data.classes.map((c) => `${c.name} ${fmt2(sumRows(rowsByClass[c.id]))}`).join(" · ")}
              </div>
            </div>
            <div className="shrink" style={{ textAlign: "right" }}>
              <div className="muted small">{currentClass.name} total</div>
              <div className="bigtotal">{fmt2(sumRows(rows))}</div>
            </div>
          </div>

          {data.classes.length > 1 && (
            <div className="tabs" style={{ marginTop: 12 }}>
              {data.classes.map((c) => (
                <button
                  key={c.id}
                  className={c.id === classId ? "" : "secondary"}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <p className="muted small">
            Type each shot: 0 to 10, or X for an X (counts 10.01). It moves to the next shot by itself.
            For a 10 type 1 then 0. You can also paste a whole card, e.g. <code>10 X X 9 8 10 …</code>
          </p>

          {rows.map((r, i) => {
            const count = r.shots.filter((s) => s !== "").length;
            const xs = r.shots.filter((s) => s === "X").length;
            return (
              <div className="cardbox" key={`${classId}-${i}`}>
                <div className="cardhead">
                  <strong>Card {i + 1}</strong>
                  <span className="cardscore">{fmt2(cardScore(r.shots))}</span>
                  <span className="muted small">{count}/{SHOTS} shots · {xs} X</span>
                </div>
                <ShotGrid
                  shots={r.shots}
                  label={`${currentClass.name} card ${i + 1}`}
                  onChange={(s) => setRow(i, { shots: s })}
                />
                <div className="row" style={{ marginTop: 8 }}>
                  <div style={{ flex: "0 0 130px" }}>
                    <label htmlFor={`fm${i}`}>First miss (shot #)</label>
                    <input
                      id={`fm${i}`}
                      inputMode="numeric"
                      value={r.fm}
                      onChange={(e) => setRow(i, { fm: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label htmlFor={`notes${i}`}>Notes</label>
                    <input
                      id={`notes${i}`}
                      value={r.notes}
                      onChange={(e) => setRow(i, { notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save scores"}</button>
            <button className="secondary" onClick={() => setSelectedId("")}>Close</button>
          </div>
          <p className="muted small">
            Save covers every class for this shooter. Leave a card empty if it hasn't been shot. First miss is optional: the shot number (1 to 25) of the first miss on that card.
          </p>
        </div>
      )}

      {selected && data.classes.length === 0 && (
        <div className="msg err">This match has no classes. Add one on the Admin page.</div>
      )}
    </>
  );
}
