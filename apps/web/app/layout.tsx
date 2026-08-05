import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ID Photo Maker — passport & ID photos in your browser",
  description:
    "Make a correctly sized passport or ID photo in seconds. Your photo never leaves your device — all processing happens in your browser.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
        Browser extensions (Grammarly, password managers, translators) inject
        attributes into <body> before React hydrates, which reads as a mismatch.
        This suppresses the warning for this element's own attributes only —
        genuine mismatches in the tree below still surface.
      */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
