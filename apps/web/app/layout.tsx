import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "../components/PwaRegister";
import "./globals.css";

/**
 * next/font downloads Inter at build time and serves it same-origin — no
 * runtime request to Google, which keeps the CSP strict and the privacy
 * claim literal.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ID Photo Maker — passport & ID photos in your browser",
  description:
    "Make a correctly sized passport or ID photo in seconds. Your photo never leaves your device — all processing happens in your browser.",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1115" },
  ],
};

/**
 * Applies the stored theme before first paint — runs synchronously as the
 * first thing in <body>, so there is no light-mode flash for dark users.
 * Kept tiny and defensive; a failure just leaves the default (light).
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning on <html>: the theme script legitimately adds
    // the "dark" class before React hydrates.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/*
        Browser extensions (Grammarly, password managers, translators) inject
        attributes into <body> before React hydrates, which reads as a mismatch.
        This suppresses the warning for this element's own attributes only —
        genuine mismatches in the tree below still surface.
      */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
