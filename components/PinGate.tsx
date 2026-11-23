"use client";

import { useEffect, useState } from "react";

export default function PinGate({
  role,
  title,
  children,
}: {
  role: "scorer" | "admin";
  title: string;
  children: (pin: string, lock: () => void) => React.ReactNode;
}) {
  const key = `rba-pin-${role}`;
  const [pin, setPin] = useState("");
  const [input, setInput] = useState("");
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState("");

  async function verify(p: string, silent: boolean) {
    try {
      const res = await fetch(`/api/verify?role=${role}`, {
        headers: { "x-pin": p },
      });
      if (!res.ok) throw new Error("Wrong PIN");
      localStorage.setItem(key, p);
      setPin(p);
      setOk(true);
      setErr("");
    } catch {
      localStorage.removeItem(key);
      if (!silent) setErr("Wrong PIN");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) verify(saved, true);
    else setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lock() {
    localStorage.removeItem(key);
    setOk(false);
    setPin("");
    setInput("");
  }

  if (checking) return <p className="muted">Loading…</p>;

  if (!ok) {
    return (
      <div className="panel" style={{ maxWidth: 420 }}>
        <h2>{title}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(input, false);
          }}
        >
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {err && <div className="msg err">{err}</div>}
          <div style={{ marginTop: 12 }}>
            <button type="submit">Unlock</button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children(pin, lock)}</>;
}
