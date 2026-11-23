"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMatchData, loadMatches } from "@/lib/client";
import { shortName } from "@/lib/names";
import { fmt2 } from "@/lib/shots";
import {
  emptyMatchData,
  onBoard,
  totalOver,
  type Entry,
  type Match,
  type MatchData,
} from "@/lib/types";

type Board = { key: string; title: string; classIds: string[]; isAgg: boolean };
type Row = { e: Entry; total: number; rank: string };

function rankBoard(entries: Entry[], classIds: string[]): Row[] {
  const list = entries
    .filter((e) => onBoard(e, classIds))
    .map((e) => ({ e, total: totalOver(e, classIds) }))
    .sort((a, b) => b.total - a.total || a.e.entry_number - b.e.entry_number);
  return list.map((r) => ({
    ...r,
    rank: `${1 + list.filter((x) => x.total > r.total).length}${
      list.filter((x) => x.total === r.total).length > 1 ? "=" : ""
    }`,
  }));
}

function Panel({
  board,
  rows,
  perPage,
  tick,
}: {
  board: Board;
  rows: Row[];
  perPage: number;
  tick: number;
}) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = tick % pages;
  const slice = rows.slice(page * perPage, (page + 1) * perPage);
  return (
    <section className={`tvpanel${board.isAgg ? " tvagg" : ""}`}>
      <header>
        <h2>{board.title}</h2>
        {pages > 1 && (
          <span className="tvpage">
            {page + 1}/{pages}
          </span>
        )}
      </header>
      <ol style={{ gridTemplateRows: `repeat(${perPage}, 1fr)` }}>
        {slice.map((r) => (
          <li key={r.e.id} className={r.rank === "1" || r.rank === "1=" ? "first" : ""}>
            <span className="rk">{r.rank}</span>
            <span className="nm">{shortName(r.e.name)}</span>
            <span className="tt">{fmt2(r.total)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="empty">No scores yet</li>}
      </ol>
    </section>
  );
}

export default function TvPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [noMatch, setNoMatch] = useState(false);
  const [perPage, setPerPage] = useState(8);
  const [secs, setSecs] = useState(8);

  // Options come from the address: /tv?match=<id>&rows=8&secs=8
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const rows = Number(p.get("rows"));
    const s = Number(p.get("secs"));
    if (Number.isInteger(rows) && rows >= 3 && rows <= 30) setPerPage(rows);
    if (Number.isFinite(s) && s >= 3 && s <= 120) setSecs(s);
    loadMatches()
      .then((m) => {
        const want = p.get("match");
        const found = (want && m.find((x) => x.id === want)) || m[0] || null;
        setMatch(found);
        setNoMatch(!found);
      })
      .catch((e) => setError(e.message));
  }, []);

  const refresh = useCallback(async () => {
    if (!match) return;
    try {
      setData(await loadMatchData(match.id));
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [match]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), secs * 1000);
    return () => clearInterval(t);
  }, [secs]);

  const boards = useMemo<Board[]>(
    () => [
      ...data.classes.map((c) => ({ key: c.id, title: c.name, classIds: [c.id], isAgg: false })),
      ...data.aggregates.map((a) => ({
        key: `agg:${a.id}`,
        title: a.name,
        classIds: a.class_ids.filter((id) => data.classes.some((c) => c.id === id)),
        isAgg: true,
      })),
    ],
    [data]
  );

  const ranked = useMemo(
    () => boards.map((b) => ({ board: b, rows: rankBoard(data.entries, b.classIds) })),
    [boards, data.entries]
  );
  const classBoards = ranked.filter((r) => !r.board.isAgg);
  const aggBoards = ranked.filter((r) => r.board.isAgg);

  return (
    <div className="tv">
      <div className="tvhead">
        <div className="tvbrand">
          {match?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tvlogo" src={match.logo} alt="" />
          )}
          <div className="tvtitle">{match ? match.name : "RBA Scoring"}</div>
        </div>
        <div className="tvmeta">
          {error ? <span className="tverr">{error}</span> : updated ? `Updated ${updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </div>
      </div>

      {noMatch && <div className="tvmsg">No match set up yet.</div>}

      {classBoards.length > 0 && (
        <div className="tvrow">
          {classBoards.map(({ board, rows }) => (
            <Panel key={board.key} board={board} rows={rows} perPage={perPage} tick={tick} />
          ))}
        </div>
      )}
      {aggBoards.length > 0 && (
        <div className="tvrow">
          {aggBoards.map(({ board, rows }) => (
            <Panel key={board.key} board={board} rows={rows} perPage={perPage} tick={tick} />
          ))}
        </div>
      )}
    </div>
  );
}
