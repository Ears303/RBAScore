import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "RBA Scoring",
  description: "Rifle benchrest scoring",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <span className="brand">RBA Scoring</span>
          <Link href="/">Scoreboard</Link>
          <Link href="/tv">TV display</Link>
          <Link href="/score">Score entry</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
