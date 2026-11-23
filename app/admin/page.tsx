"use client";

import { useEffect, useState } from "react";
import PinGate from "@/components/PinGate";
import { api, loadMatchData, loadMatches } from "@/lib/client";
import { emptyMatchData, hasClass, type Entry, type Match, type MatchData } from "@/lib/types";

/** "Sporter:3, Light:2, Heavy:2" -> classes with their card counts (default used when no count is given). */
function parseClasses(text: string, defaultCards: number) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+?)\s*[:=]\s*(\d+)$/);
      return m
        ? { name: m[1].trim(), num_cards: Number(m[2]) }
        : { name: s, num_cards: defaultCards };
    });
}

/** Shrinks an image file to a small PNG data URL (keeps transparency) so it can be stored with the match. */
async function logoDataUrl(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file is not an image I can read"));
      i.src = src;
    });
    for (const max of [400, 300, 200]) {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      if (url.length <= 380_000) return url;
    }
    throw new Error("That logo is too detailed to store. Try a simpler or smaller image.");
  } finally {
    URL.revokeObjectURL(src);
  }
}

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
  const [data, setData] = useState<MatchData>(emptyMatchData());
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [mName, setMName] = useState("");
  const [mDate, setMDate] = useState("");
  const [mCards, setMCards] = useState("2");
  const [mClasses, setMClasses] = useState("");

  const [eNum, setENum] = useState("");
  const [eName, setEName] = useState("");
  const [eMember, setEMember] = useState("");
  // WASRA membership numbers by entry id (admin only, loaded through the server)
  const [members, setMembers] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");

  const [newClass, setNewClass] = useState("");
  const [newClassCards, setNewClassCards] = useState("2");
  const [cardEdits, setCardEdits] = useState<Record<string, string>>({});
  const [aName, setAName] = useState("");
  const [aSel, setASel] = useState<Set<string>>(new Set());

  const fail = (e: unknown) =>
    setMsg({ kind: "err", text: e instanceof Error ? e.message : "Something went wrong" });

  async function reloadMatches(selectId?: string) {
    const m = await loadMatches();
    setMatches(m);
    setMatchId(selectId ?? (m.find((x) => x.id === matchId) ? matchId : m[0]?.id ?? ""));
  }

  async function reloadData() {
    if (!matchId) {
      setData(emptyMatchData());
      setMembers({});
      return;
    }
    setData(await loadMatchData(matchId));
    const res = await api(`/api/entries?match_id=${matchId}`, pin, undefined, "GET");
    const map: Record<string, string> = {};
    for (const en of res.entries as { id: string; membership_number: string | null }[]) {
      if (en.membership_number) map[en.id] = en.membership_number;
    }
    setMembers(map);
  }

  useEffect(() => {
    reloadMatches().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setASel(new Set());
    reloadData().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api("/api/matches", pin, {
        name: mName,
        match_date: mDate || null,
        default_cards: Number(mCards),
        classes: parseClasses(mClasses, Number(mCards)),
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

  async function setLogo(file: File | null) {
    try {
      const logo = file ? await logoDataUrl(file) : null;
      await api("/api/matches", pin, { id: matchId, logo }, "PATCH");
      await reloadMatches(matchId);
      setMsg({ kind: "ok", text: logo ? "Logo saved" : "Logo removed" });
    } catch (err) {
      fail(err);
    }
  }

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/classes", pin, {
        match_id: matchId,
        name: newClass,
        num_cards: Number(newClassCards),
      });
      setNewClass("");
      await reloadData();
      setMsg({ kind: "ok", text: "Class added. Add it to an aggregate below if needed." });
    } catch (err) {
      fail(err);
    }
  }

  async function saveCards(id: string) {
    try {
      await api("/api/classes", pin, { id, num_cards: Number(cardEdits[id]) }, "PATCH");
      setCardEdits((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
      await reloadData();
      setMsg({ kind: "ok", text: "Cards updated" });
    } catch (err) {
      fail(err);
    }
  }

  async function addAggregate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/aggregates", pin, {
        match_id: matchId,
        name: aName,
        class_ids: Array.from(aSel),
      });
      setAName("");
      setASel(new Set());
      await reloadData();
      setMsg({ kind: "ok", text: "Aggregate added" });
    } catch (err) {
      fail(err);
    }
  }

  async function deleteAggregate(id: string, name: string) {
    if (!confirm(`Delete the "${name}" aggregate? Scores are not affected.`)) return;
    try {
      await api(`/api/aggregates?id=${id}`, pin, undefined, "DELETE");
      await reloadData();
    } catch (err) {
      fail(err);
    }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api("/api/entries", pin, {
        match_id: matchId,
        rows: [
          {
            entry_number: eNum.trim() === "" ? null : Number(eNum),
            name: eName,
            membership_number: eMember,
          },
        ],
      });
      setENum("");
      setEName("");
      setEMember("");
      await reloadData();
      const saved = res.entries?.[0];
      setMsg({ kind: "ok", text: `Saved #${saved?.entry_number ?? ""} ${saved?.name ?? eName}` });
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
        // [entry number,] name [, WASRA membership number]. No entry number = next free number.
        const parts = l.split(/[,\t]/).map((s) => s.trim());
        const hasNum = parts.length >= 2 && /^\d+$/.test(parts[0]);
        const [name, member] = hasNum ? parts.slice(1) : parts;
        return {
          entry_number: hasNum ? Number(parts[0]) : null,
          name,
          membership_number: member || null,
        };
      });
    try {
      const res = await api("/api/entries", pin, { match_id: matchId, rows });
      setBulk("");
      await reloadData();
      setMsg({ kind: "ok", text: `Imported ${res.count} entries` });
    } catch (err) {
      fail(err);
    }
  }

  async function deleteEntry(en: Entry) {
    if (!confirm(`Delete #${en.entry_number} ${en.name} and their scores?`)) return;
    try {
      await api(`/api/entries?id=${en.id}`, pin, undefined, "DELETE");
      await reloadData();
    } catch (err) {
      fail(err);
    }
  }

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name ?? "?";

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
              <label htmlFor="mcards">Default cards per class</label>
              <input id="mcards" inputMode="numeric" value={mCards} onChange={(e) => setMCards(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: "3 1 300px" }}>
              <label htmlFor="mclasses">Classes, each with its number of cards</label>
              <input
                id="mclasses"
                value={mClasses}
                onChange={(e) => setMClasses(e.target.value)}
                placeholder="Sporter:3, Light:2, Heavy:2"
                required
              />
            </div>
            <div className="shrink">
              <button type="submit">Create</button>
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            With 3 classes the match gets a "3 Gun Agg" (all three) and a "2 Gun Agg" (the Light and Heavy classes)
            automatically. You can change aggregates after creating the match.
          </p>
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
                  {m.name}{m.match_date ? ` (${m.match_date})` : ""}
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
            <h2>Event logo</h2>
            <div className="row" style={{ alignItems: "center" }}>
              {matches.find((m) => m.id === matchId)?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="logo" src={matches.find((m) => m.id === matchId)!.logo!} alt="Current logo" style={{ flex: "0 0 auto" }} />
              ) : (
                <span className="muted small shrink">No logo yet</span>
              )}
              <div>
                <label htmlFor="logofile">Upload a logo for this match (PNG or JPG)</label>
                <input
                  id="logofile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setLogo(f);
                  }}
                />
              </div>
              {matches.find((m) => m.id === matchId)?.logo && (
                <div className="shrink">
                  <button className="secondary" onClick={() => setLogo(null)}>Remove logo</button>
                </div>
              )}
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Each match has its own logo. It shows on the TV display and at the top of the scoreboard.
            </p>
          </div>

          <div className="panel">
            <h2>Classes and aggregates</h2>
            {data.classes.map((c) => {
              const edit = cardEdits[c.id];
              const changed = edit !== undefined && edit !== String(c.num_cards);
              return (
                <div key={c.id} className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                  <div><strong>{c.name}</strong></div>
                  <div className="shrink" style={{ width: 90 }}>
                    <input
                      aria-label={`${c.name} cards`}
                      inputMode="numeric"
                      value={edit ?? String(c.num_cards)}
                      onChange={(e) => setCardEdits((s) => ({ ...s, [c.id]: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                  <div className="muted small shrink">cards</div>
                  <div className="shrink">
                    <button className="secondary" onClick={() => saveCards(c.id)} disabled={!changed}>Save</button>
                  </div>
                </div>
              );
            })}
            <form onSubmit={addClass} style={{ marginTop: 12 }}>
              <div className="row">
                <div>
                  <label htmlFor="newclass">Add a class</label>
                  <input id="newclass" value={newClass} onChange={(e) => setNewClass(e.target.value)} required />
                </div>
                <div className="shrink" style={{ width: 90 }}>
                  <label htmlFor="newclasscards">Cards</label>
                  <input
                    id="newclasscards"
                    inputMode="numeric"
                    value={newClassCards}
                    onChange={(e) => setNewClassCards(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="shrink">
                  <button type="submit">Add class</button>
                </div>
              </div>
            </form>

            <h2 style={{ marginTop: 24 }}>Aggregates</h2>
            {data.aggregates.length === 0 && <p className="muted small">None yet.</p>}
            {data.aggregates.map((a) => (
              <div key={a.id} className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                <div>
                  <strong>{a.name}</strong>{" "}
                  <span className="muted small">= {a.class_ids.map(className).join(" + ")}</span>
                </div>
                <div className="shrink">
                  <button className="danger" onClick={() => deleteAggregate(a.id, a.name)}>Delete</button>
                </div>
              </div>
            ))}

            <form onSubmit={addAggregate} style={{ marginTop: 12 }}>
              <div className="row">
                <div>
                  <label htmlFor="aname">New aggregate name</label>
                  <input id="aname" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="2 Gun Agg" required />
                </div>
                <div style={{ flex: "2 1 260px" }}>
                  <label>Classes it adds up</label>
                  <div className="chips">
                    {data.classes.map((c) => (
                      <label key={c.id} className="check">
                        <input
                          type="checkbox"
                          checked={aSel.has(c.id)}
                          onChange={() =>
                            setASel((s) => {
                              const n = new Set(s);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="shrink">
                  <button type="submit">Add aggregate</button>
                </div>
              </div>
            </form>
          </div>

          <div className="panel">
            <h2>Add or update an entry</h2>
            <form onSubmit={addEntry}>
              <div className="row">
                <div>
                  <label htmlFor="enum">Entry number (blank = automatic)</label>
                  <input
                    id="enum"
                    inputMode="numeric"
                    value={eNum}
                    onChange={(e) => setENum(e.target.value.replace(/\D/g, ""))}
                    placeholder="auto"
                  />
                </div>
                <div style={{ flex: "2 1 220px" }}>
                  <label htmlFor="ename">Name</label>
                  <input id="ename" value={eName} onChange={(e) => setEName(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="emember">WASRA membership number</label>
                  <input id="emember" value={eMember} onChange={(e) => setEMember(e.target.value)} />
                </div>
                <div className="shrink">
                  <button type="submit">Save entry</button>
                </div>
              </div>
            </form>

            <h2 style={{ marginTop: 24 }}>Bulk import</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              One competitor per line: <code>name, WASRA membership number</code> (the membership number is
              optional). The next free entry number is assigned automatically, or start the line with a number to
              choose it, e.g. <code>20, name, membership number</code> (an existing entry number is updated). A
              competitor has one entry number for all the classes they shoot.
            </p>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Paul Donohoe, 1234\nJane Smith, 5678\n20, Entry number chosen by you, 9012"}
            />
            <div style={{ marginTop: 8 }}>
              <button onClick={importBulk} disabled={!bulk.trim()}>Import</button>
            </div>
          </div>

          <div className="panel table-wrap">
            <h2>Entries ({data.entries.length})</h2>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Name</th>
                  <th>WASRA #</th>
                  <th>Classes scored</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.entries.map((en) => (
                  <tr key={en.id}>
                    <td className="num">{en.entry_number}</td>
                    <td>{en.name}</td>
                    <td className="muted">{members[en.id] ?? ""}</td>
                    <td className="muted">
                      {data.classes.filter((c) => hasClass(en, c.id)).map((c) => c.name).join(", ")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="danger" onClick={() => deleteEntry(en)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {data.entries.length === 0 && (
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
