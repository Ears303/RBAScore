import "./globals.css";
import NavBar from "@/components/NavBar";
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
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
