"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The public menu only shows the scoreboard and TV display. The Score entry and Admin links appear
 * only on a device where someone has already unlocked that area with a PIN, so a shared link does not
 * advertise them.
 */
export default function NavBar() {
  const [showScore, setShowScore] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    try {
      const admin = !!localStorage.getItem("rba-pin-admin");
      setShowAdmin(admin);
      setShowScore(admin || !!localStorage.getItem("rba-pin-scorer"));
    } catch {
      /* storage blocked: stay on the public menu */
    }
  }, []);

  return (
    <nav>
      <span className="brand">RBA Scoring</span>
      <Link href="/">Scoreboard</Link>
      <Link href="/tv">TV display</Link>
      {showScore && <Link href="/score">Score entry</Link>}
      {showAdmin && <Link href="/admin">Admin</Link>}
    </nav>
  );
}
