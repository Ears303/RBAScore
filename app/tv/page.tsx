"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMatchData, loadMatches } from "@/lib/client";
import { shortName } from "@/lib/names";
import { fmt2 } from "@/lib/shots";
import { colsFor, makeBoards, perfectCards, rankBoard, type Board, type Col, type Row } from "@/lib/boards";
import { emptyMatchData, type Match, type MatchData } from "@/lib/types";

function Panel({
  board,
  rows,
  cols,
  perPage,
  tick,
}: {
  board: Board;
  rows: Row[];
  cols: Col[];
  perPage: number;
  tick: number;
}) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = tick % pages;
  const slice = rows.slice(page * perPage, (page + 1) * perPage);
  const colW = board.isAgg ? 3.9 : 2.8; // aggregate columns carry class names such as "Light Gun"
  const grid = `1.5em minmax(0, 1fr) repeat(${cols.length}, ${colW}em) ${board.isAgg ? "4.9em" : "4.4em"}`;
  return (
    <section
      className={`tvpanel${board.isAgg ? " tvagg" : ""}`}
      style={{ flexGrow: 1, flexBasis: `calc(${cols.length} * ${colW + 0.45}em + 15em)` }}
    >
      <header>
        <h2>{board.title}</h2>
        {pages > 1 && (
          <span className="tvpage">
            {page + 1}/{pages}
          </span>
        )}
      </header>
      <div className="tvhdr" style={{ gridTemplateColumns: grid }}>
        <span />
        <span />
        {cols.map((c) => (
          <span key={c.label} className="cd">{board.isAgg ? c.label.replace(/\s+/g, "\n") : c.label}</span>
        ))}
        <span className="tt">Score</span>
      </div>
      <ol style={{ gridTemplateRows: `repeat(${perPage}, minmax(0, 1fr))` }}>
        {slice.map((r) => (
          <li
            key={r.e.id}
            className={`m${parseInt(r.rank, 10) || 0}`}
            style={{ gridTemplateColumns: grid }}
          >
            <span className="rk">{r.rank}</span>
            <span className="nm">{shortName(r.e.name)}</span>
            {cols.map((c) => (
              <span key={c.label} className="cd">{c.get(r.e)}</span>
            ))}
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

  const ranked = useMemo(
    () =>
      makeBoards(data).map((board) => ({
        board,
        rows: rankBoard(data.entries, board.classIds),
        cols: colsFor(board, data),
      })),
    [data]
  );
  const perfect = useMemo(() => perfectCards(data), [data]);
  // the 250 strip is one fixed line, so it pages through the 250s three at a time
  const perfPages = Math.max(1, Math.ceil(perfect.length / 3));
  const perfPage = tick % perfPages;
  const perfSlice = perfect.slice(perfPage * 3, perfPage * 3 + 3);
  const classBoards = ranked.filter((r) => !r.board.isAgg);
  const aggBoards = ranked.filter((r) => r.board.isAgg);

  return (
    <div className={`tv${perfect.length > 0 ? " tvhasperfect" : ""}`}>
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

      {perfect.length > 0 && (
        <div className="tvperfect">
          <span className="pfl">250</span>
          {perfSlice.map((p) => (
            <span key={p.id} className="pfc">
              <b>{shortName(p.name)}</b> {p.className} · Card {p.card}
            </span>
          ))}
          {perfPages > 1 && (
            <span className="tvpage" style={{ marginLeft: "auto" }}>
              {perfPage + 1}/{perfPages}
            </span>
          )}
        </div>
      )}

      {noMatch && <div className="tvmsg">No match set up yet.</div>}

      {classBoards.length > 0 && (
        <div className="tvrow">
          {classBoards.map(({ board, rows, cols }) => (
            <Panel key={board.key} board={board} rows={rows} cols={cols} perPage={perPage} tick={tick} />
          ))}
        </div>
      )}
      {aggBoards.length > 0 && (
        <div className="tvrow">
          {aggBoards.map(({ board, rows, cols }) => (
            <Panel key={board.key} board={board} rows={rows} cols={cols} perPage={perPage} tick={tick} />
          ))}
        </div>
      )}
    </div>
  );
}
