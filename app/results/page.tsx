"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMatchData, loadMatches } from "@/lib/client";
import { colsFor, makeBoards, perfectCards, rankBoard } from "@/lib/boards";
import { shortName } from "@/lib/names";
import { fmt2 } from "@/lib/shots";
import { emptyMatchData, type Match, type MatchData } from "@/lib/types";

/** Printable results sheet. "Save as PDF" in the print window gives the PDF. */
export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  const [entryNo, setEntryNo] = useState(true);
  const [perfect, setPerfect] = useState(true);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [onePerPage, setOnePerPage] = useState(false);

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
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [matchId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const match = matches.find((m) => m.id === matchId);
  const boards = useMemo(
    () =>
      makeBoards(data).map((board) => ({
        board,
        rows: rankBoard(data.entries, board.classIds),
        cols: colsFor(board, data),
      })),
    [data]
  );
  const perf = useMemo(() => perfectCards(data), [data]);
  const name = (n: string) => (full ? n : shortName(n));

  return (
    <div className="results">
      <div className="noprint panel">
        <h1 style={{ marginTop: 0 }}>Results sheet (PDF)</h1>
        <div className="row">
          {matches.length > 1 && (
            <div>
              <label htmlFor="rm">Match</label>
              <select id="rm" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.match_date ? ` (${m.match_date})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="rchecks">
          <label><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Full surnames</label>
          <label><input type="checkbox" checked={entryNo} onChange={(e) => setEntryNo(e.target.checked)} /> Entry numbers</label>
          <label><input type="checkbox" checked={perfect} onChange={(e) => setPerfect(e.target.checked)} /> List the 250s</label>
          <label><input type="checkbox" checked={onePerPage} onChange={(e) => setOnePerPage(e.target.checked)} /> One board per page</label>
          {boards.map(({ board }) => (
            <label key={board.key}>
              <input
                type="checkbox"
                checked={!hidden[board.key]}
                onChange={(e) => setHidden({ ...hidden, [board.key]: !e.target.checked })}
              />{" "}
              {board.title}
            </label>
          ))}
        </div>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <p className="muted small">In the print window choose “Save as PDF” as the printer.</p>
        {error && <div className="msg err">{error}</div>}
      </div>

      <div className="rsheet">
        <div className="rhead">
          {match?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.logo} alt="" />
          )}
          <div>
            <h1>{match?.name ?? "Results"}</h1>
            <div className="muted">
              {match?.match_date ? `${match.match_date} · ` : ""}Results
            </div>
          </div>
        </div>

        {perfect && perf.length > 0 && (
          <div className="rperf">
            <b>250s:</b> {perf.map((p) => `${name(p.name)} (${p.className}, Card ${p.card})`).join("; ")}
          </div>
        )}

        {boards
          .filter(({ board }) => !hidden[board.key])
          .map(({ board, rows, cols }) => (
            <section key={board.key} className={`rboard${onePerPage ? " rbreak" : ""}`}>
              <h2>{board.title}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Pos</th>
                    {entryNo && <th>No.</th>}
                    <th className="l">Name</th>
                    {cols.map((c) => (
                      <th key={c.label}>{c.label}</th>
                    ))}
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.e.id}>
                      <td>{r.rank}</td>
                      {entryNo && <td>{r.e.entry_number}</td>}
                      <td className="l">{name(r.e.name)}</td>
                      {cols.map((c) => (
                        <td key={c.label}>{c.get(r.e)}</td>
                      ))}
                      <td><b>{fmt2(r.total)}</b></td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={cols.length + (entryNo ? 4 : 3)} className="l">No scores yet</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          ))}
        <p className="muted small">The decimals are the X count (247.18 is 247 with 18 X).</p>
      </div>
    </div>
  );
}
