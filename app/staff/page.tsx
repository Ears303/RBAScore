"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * One sign-in for everyone. Enter a PIN: the scorer PIN opens score entry, the admin PIN opens
 * both score entry and admin. The public address stays the same for all.
 */
export default function StaffPage() {
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"" | "scorer" | "admin">("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("rba-pin-admin")) setRole("admin");
      else if (localStorage.getItem("rba-pin-scorer")) setRole("scorer");
    } catch {
      /* ignore */
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/verify?role=scorer", { headers: { "x-pin": input } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Wrong PIN");
        return;
      }
      localStorage.setItem("rba-pin-scorer", input);
      if (j.role === "admin") localStorage.setItem("rba-pin-admin", input);
      window.dispatchEvent(new Event("rba-pin-change"));
      setInput("");
      if (j.role === "admin") setRole("admin");
      else window.location.href = "/score";
    } catch {
      setErr("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    try {
      localStorage.removeItem("rba-pin-scorer");
      localStorage.removeItem("rba-pin-admin");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("rba-pin-change"));
    setRole("");
  }

  if (role) {
    return (
      <div className="panel" style={{ maxWidth: 420 }}>
        <h2>Signed in{role === "admin" ? " as admin" : ""}</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Link href="/score"><button type="button" style={{ width: "100%" }}>Score entry</button></Link>
          {role === "admin" && (
            <Link href="/admin"><button type="button" style={{ width: "100%" }}>Admin</button></Link>
          )}
          <button type="button" className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 420 }}>
      <h2>Staff sign-in</h2>
      <form onSubmit={signIn}>
        <label htmlFor="spin">PIN</label>
        <input
          id="spin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={busy || !input} style={{ marginTop: 10 }}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        {err && <div className="msg err">{err}</div>}
      </form>
      <p className="muted small">Scorers go to score entry. Admins can open score entry and admin.</p>
    </div>
  );
}
