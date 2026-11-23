"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { loadMatchData, loadMatches } from "@/lib/client";
import { fmt2, shotLabel } from "@/lib/shots";
import {
  cardOf,
  classTotal,
  emptyMatchData,
  onBoard,
  scoresIn,
  totalOver,
  type Entry,
  type Match,
  type MatchData,
  type RbaClass,
} from "@/lib/types";

type View = { key: string; label: string; classIds: string[]; isAgg: boolean };
type Ranked = { e: Entry; total: number; rank: string };

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [viewKey, setViewKey] = useState("");
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

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
      setData(await loadMatchData(matchId));
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [matchId]);

  useEffect(() => {
    setData(emptyMatchData());
    setViewKey("");
    setOpen(new Set());
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const views = useMemo<View[]>(
    () => [
      ...data.classes.map((c) => ({ key: c.id, label: c.name, classIds: [c.id], isAgg: false })),
      ...data.aggregates.map((a) => ({
        key: `agg:${a.id}`,
        label: a.name,
        classIds: a.class_ids.filter((id) => data.classes.some((c) => c.id === id)),
        isAgg: true,
      })),
    ],
    [data]
  );
  const match = matches.find((m) => m.id === matchId);
  const view = views.find((v) => v.key === viewKey) ?? views[0];
  // Card columns only apply to a single class board; each class has its own number of cards.
  const numCards =
    view && !view.isAgg ? data.classes.find((c) => c.id === view.classIds[0])?.num_cards ?? 0 : 0;

  const ranked = useMemo<Ranked[]>(() => {
    if (!view) return [];
    const needle = q.trim().toLowerCase();
    const list = data.entries
      .filter(
        (e) =>
          onBoard(e, view.classIds) &&
          (!needle || e.name.toLowerCase().includes(needle) || String(e.entry_number) === needle)
      )
      .map((e) => ({ e, total: totalOver(e, view.classIds) }))
      .sort((a, b) => b.total - a.total || a.e.entry_number - b.e.entry_number);
    return list.map((r) => ({
      ...r,
      rank: `${1 + list.filter((x) => x.total > r.total).length}${
        list.filter((x) => x.total === r.total).length > 1 ? "=" : ""
      }`,
    }));
  }, [data, view, q]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const classOf = (id: string) => data.classes.find((c) => c.id === id);
  const viewClasses = (view?.classIds ?? [])
    .map(classOf)
    .filter(Boolean) as RbaClass[];
  const colCount = 4 + (view?.isAgg ? viewClasses.length : numCards);

  return (
    <>
      <div className="titlerow">
        {match?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="logo" src={match.logo} alt="" />
        )}
        <h1>{match ? match.name : "Scoreboard"}</h1>
      </div>

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
            <label htmlFor="q">Find name or entry number</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {views.length > 0 && (
          <div className="tabs" style={{ marginTop: 12, marginBottom: 0 }}>
            {views.map((v, i) => (
              <Fragment key={v.key}>
                {v.isAgg && !views[i - 1]?.isAgg && <span className="gap" />}
                <button
                  className={v.key === view?.key ? "" : "secondary"}
                  onClick={() => setViewKey(v.key)}
                >
                  {v.label}
                </button>
              </Fragment>
            ))}
          </div>
        )}

        <p className="muted small" style={{ margin: "12px 0 0" }}>
          {updated ? `Updated ${updated.toLocaleTimeString()}. ` : ""}
          Refreshes automatically. The decimals are the X count (247.18 is 247 with 18 X). Small figure under a
          card is the first miss shot number. Aggregates list a shooter once they have scores in every class
          it covers. Tap a row to see every shot.
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
              {view?.isAgg
                ? viewClasses.map((c) => (
                    <th key={c.id} className="num">{c.name}</th>
                  ))
                : Array.from({ length: numCards }, (_, i) => (
                    <th key={i} className="num">C{i + 1}</th>
                  ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {view &&
              ranked.map(({ e, total, rank }) => (
                <Fragment key={e.id}>
                  <tr onClick={() => toggle(e.id)} style={{ cursor: "pointer" }}>
                    <td className="num">{rank}</td>
                    <td className="num">{e.entry_number}</td>
                    <td>{e.name}</td>
                    {view.isAgg
                      ? viewClasses.map((c) => (
                          <td key={c.id} className="num">{fmt2(classTotal(e, c.id))}</td>
                        ))
                      : Array.from({ length: numCards }, (_, i) => {
                          const c = cardOf(e, view.classIds[0], i + 1);
                          return (
                            <td key={i} className="num">
                              {c ? (
                                <>
                                  {fmt2(Number(c.score))}
                                  {c.notes && (
                                    <span className="note-dot" title={c.notes}>
                                      {" "}•
                                    </span>
                                  )}
                                  {c.first_miss != null && (
                                    <span className="fm">fm {c.first_miss}</span>
                                  )}
                                </>
                              ) : (
                                <span className="muted">–</span>
                              )}
                            </td>
                          );
                        })}
                    <td className="total">{fmt2(total)}</td>
                  </tr>
                  {open.has(e.id) && (
                    <tr>
                      <td colSpan={colCount} className="detail">
                        {viewClasses.map((cl) => (
                          <div key={cl.id} style={{ marginBottom: 8 }}>
                            {view.isAgg && <strong>{cl.name}</strong>}
                            {scoresIn(e, cl.id)
                              .slice()
                              .sort((a, b) => a.card_number - b.card_number)
                              .map((c) => (
                                <div key={c.id} style={{ marginTop: 4 }}>
                                  <span className="muted small">Card {c.card_number}</span>{" "}
                                  <span className="mono">
                                    {(c.shots ?? []).map((v) => shotLabel(Number(v))).join(" ")}
                                  </span>
                                  {c.notes && <div className="muted small">Note: {c.notes}</div>}
                                </div>
                              ))}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={colCount} className="muted">
                  {views.length === 0 ? "No match set up yet." : "No scores to show yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
