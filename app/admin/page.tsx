"use client";

import { useEffect, useState } from "react";
import PinGate from "@/components/PinGate";
import { api, loadEntries, loadMatches } from "@/lib/client";
import type { Entry, Match } from "@/lib/types";

export default function AdminPage() {
  return (
    <>
      <h1>Admin</h1>
      <PinGate role="admin" title="Admin PIN">
        {(pin, lock) => <Admin pin={pin} lock={lock} />}
      </PinGate>
    </>
  );
}

function Admin({ pin, lock }: { pin: string; lock: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [mName, setMName] = useState("");
  const [mDate, setMDate] = useState("");
  const [mCards, setMCards] = useState("5");

  const [eNum, setENum] = useState("");
  const [eName, setEName] = useState("");
  const [eClass, setEClass] = useState("");
  const [bulk, setBulk] = useState("");

  const fail = (e: unknown) =>
    setMsg({ kind: "err", text: e instanceof Error ? e.message : "Something went wrong" });

  async function reloadMatches(selectId?: string) {
    const m = await loadMatches();
    setMatches(m);
    setMatchId(selectId ?? (m.find((x) => x.id === matchId) ? matchId : m[0]?.id ?? ""));
  }

  async function reloadEntries() {
    if (!matchId) return setEntries([]);
    setEntries(await loadEntries(matchId));
  }

  useEffect(() => {
    reloadMatches().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadEntries().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api("/api/matches", pin, {
        name: mName,
        match_date: mDate || null,
        num_cards: Number(mCards),
      });
      setMName("");
      setMDate("");
      await reloadMatches(res.match.id);
      setMsg({ kind: "ok", text: "Match created" });
    } catch (err) {
      fail(err);
    }
  }

  async function deleteMatch() {
    const m = matches.find((x) => x.id === matchId);
    if (!m || !confirm(`Delete "${m.name}" and ALL its entries and scores?`)) return;
    try {
      await api(`/api/matches?id=${m.id}`, pin, undefined, "DELETE");
      await reloadMatches("");
      setMsg({ kind: "ok", text: "Match deleted" });
    } catch (err) {
      fail(err);
    }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/entries", pin, {
        match_id: matchId,
        rows: [{ entry_number: Number(eNum), name: eName, class: eClass }],
      });
      setENum("");
      setEName("");
      await reloadEntries();
      setMsg({ kind: "ok", text: "Entry saved" });
    } catch (err) {
      fail(err);
    }
  }

  async function importBulk() {
    const rows = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [num, name, cls] = l.split(/[,\t]/).map((s) => s.trim());
        return { entry_number: Number(num), name, class: cls || null };
      });
    try {
      const res = await api("/api/entries", pin, { match_id: matchId, rows });
      setBulk("");
      await reloadEntries();
      setMsg({ kind: "ok", text: `Imported ${res.count} entries` });
    } catch (err) {
      fail(err);
    }
  }

  async function deleteEntry(en: Entry) {
    if (!confirm(`Delete #${en.entry_number} ${en.name} and their scores?`)) return;
    try {
      await api(`/api/entries?id=${en.id}`, pin, undefined, "DELETE");
      await reloadEntries();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="panel">
        <h2>New match</h2>
        <form onSubmit={createMatch}>
          <div className="row">
            <div style={{ flex: "2 1 220px" }}>
              <label htmlFor="mname">Name</label>
              <input id="mname" value={mName} onChange={(e) => setMName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="mdate">Date</label>
              <input id="mdate" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="mcards">Number of cards</label>
              <input id="mcards" inputMode="numeric" value={mCards} onChange={(e) => setMCards(e.target.value)} />
            </div>
            <div className="shrink">
              <button type="submit">Create</button>
            </div>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="row">
          <div style={{ flex: "2 1 260px" }}>
            <label htmlFor="amatch">Working on match</label>
            <select id="amatch" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              {matches.length === 0 && <option value="">No matches yet</option>}
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.match_date ? ` (${m.match_date})` : ""} · {m.num_cards} cards
                </option>
              ))}
            </select>
          </div>
          <div className="shrink">
            <button className="danger" onClick={deleteMatch} disabled={!matchId}>Delete match</button>
          </div>
          <div className="shrink">
            <button className="secondary" onClick={lock}>Lock</button>
          </div>
        </div>
      </div>

      {matchId && (
        <>
          <div className="panel">
            <h2>Add or update an entry</h2>
            <form onSubmit={addEntry}>
              <div className="row">
                <div>
                  <label htmlFor="enum">Entry number</label>
                  <input id="enum" inputMode="numeric" value={eNum} onChange={(e) => setENum(e.target.value)} required />
                </div>
                <div style={{ flex: "2 1 220px" }}>
                  <label htmlFor="ename">Name</label>
                  <input id="ename" value={eName} onChange={(e) => setEName(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="eclass">Class (optional)</label>
                  <input id="eclass" value={eClass} onChange={(e) => setEClass(e.target.value)} />
                </div>
                <div className="shrink">
                  <button type="submit">Save entry</button>
                </div>
              </div>
            </form>

            <h2 style={{ marginTop: 24 }}>Bulk import</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              One entry per line: <code>number, name, class</code> (class optional). Existing numbers are updated.
            </p>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"1, Paul Donohoe, Rimfire\n2, Jane Smith, Rimfire"}
            />
            <div style={{ marginTop: 8 }}>
              <button onClick={importBulk} disabled={!bulk.trim()}>Import</button>
            </div>
          </div>

          <div className="panel table-wrap">
            <h2>Entries ({entries.length})</h2>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th className="num">Cards scored</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((en) => (
                  <tr key={en.id}>
                    <td className="num">{en.entry_number}</td>
                    <td>{en.name}</td>
                    <td className="muted">{en.class ?? ""}</td>
                    <td className="num">{en.card_scores.length}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="danger" onClick={() => deleteEntry(en)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="muted">No entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
