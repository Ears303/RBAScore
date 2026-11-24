"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMatchData, loadMatches } from "@/lib/client";
import { colsFor, makeBoards, rankBoard, type Board, type Col, type Row } from "@/lib/boards";
import { shortName } from "@/lib/names";
import { fmt2 } from "@/lib/shots";
import { emptyMatchData, type Match, type MatchData } from "@/lib/types";

function BoardCard({
  board,
  rows,
  cols,
  searching,
}: {
  board: Board;
  rows: Row[];
  cols: Col[];
  searching: boolean;
}) {
  const score = board.isAgg ? "4.8em" : "4.2em";
  const grid = `1.5em minmax(0, 1fr) repeat(${cols.length}, ${board.isAgg ? "3.8em" : "3.2em"}) ${score}`;
  const gridNarrow = `1.5em minmax(0, 1fr) ${score}`; // phones: name and score only
  // a wide aggregate (3 classes) drops its per-class columns on a phone so names stay readable
  const wide = board.isAgg && cols.length > 2;
  const vars = { "--g": grid, "--gn": gridNarrow } as React.CSSProperties;
  return (
    <section className={`pb${board.isAgg ? " pbagg" : ""}${wide ? " pbwide" : ""}`} style={vars}>
      <h2>{board.title}</h2>
      <div className="pbhdr">
        <span />
        <span />
        {cols.map((c) => (
          <span key={c.label} className="cd">{c.label}</span>
        ))}
        <span>Score</span>
      </div>
      <ol>
        {rows.map((r) => (
          <li
            key={r.e.id}
            className={r.rank === "1" || r.rank === "1=" ? "first" : ""}
          >
            <span className="rk">{r.rank}</span>
            <span className="nm">{shortName(r.e.name)}</span>
            {cols.map((c) => (
              <span key={c.label} className="cd">{c.get(r.e)}</span>
            ))}
            <span className="tt">{fmt2(r.total)}</span>
          </li>
        ))}
      </ol>
      {rows.length === 0 && (
        <p className="muted small" style={{ margin: "8px 0" }}>
          {searching ? "No match for that search." : "No scores yet."}
        </p>
      )}
    </section>
  );
}

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
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
      setData(await loadMatchData(matchId));
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [matchId]);

  useEffect(() => {
    setData(emptyMatchData());
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const match = matches.find((m) => m.id === matchId);
  const needle = q.trim().toLowerCase();

  // Rank on everyone first, then filter, so a search never changes anyone's rank.
  const boards = useMemo(
    () =>
      makeBoards(data).map((board) => ({
        board,
        rows: rankBoard(data.entries, board.classIds),
        cols: colsFor(board, data),
      })),
    [data]
  );

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
          {matches.length > 1 && (
            <div>
              <label htmlFor="match">Match</label>
              <select id="match" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.match_date ? ` (${m.match_date})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="q">Find a shooter</label>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or entry number"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {error && <div className="msg err">{error}</div>}
      {matches.length === 0 && !error && <p className="muted">No match set up yet.</p>}

      <div className="boards">
        {boards.map(({ board, rows, cols }) => (
          <BoardCard
            key={board.key}
            board={board}
            cols={cols}
            searching={!!needle}
            rows={
              needle
                ? rows.filter(
                    (r) =>
                      r.e.name.toLowerCase().includes(needle) ||
                      String(r.e.entry_number) === needle
                  )
                : rows
            }
          />
        ))}
      </div>

      <p className="muted small">
        {updated ? `Updated ${updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. ` : ""}
        Updates automatically. The decimals are the X count (247.18 is 247 with 18 X).{" "}
        <Link href="/details">See every shot and first miss</Link>
      </p>
    </>
  );
}
