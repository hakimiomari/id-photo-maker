"use client";

import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import { IconMonitor, IconMoon, IconSun } from "./icons";

/**
 * Light / Dark / System, persisted in localStorage("theme"). The inline script
 * in layout.tsx applies the stored choice before first paint; this control
 * only has to keep the <html> class and storage in sync afterwards.
 *
 * Anything that paints theme colours outside CSS (the editor canvas) listens
 * for the "themechange" window event.
 */

export type ThemeMode = "light" | "dark" | "system";

const KEY = "theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(mode: ThemeMode): void {
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  window.dispatchEvent(new Event("themechange"));
}

const MODES = [
  { id: "light", Icon: IconSun },
  { id: "dark", Icon: IconMoon },
  { id: "system", Icon: IconMonitor },
] as const;

export function ThemeToggle() {
  const { t } = useT();
  // Render the neutral default on the server; the real mode arrives in the
  // effect, after hydration, so markup always matches.
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as ThemeMode | null;
    setMode(stored ?? "system");

    // Follow OS changes live while in system mode.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (((localStorage.getItem(KEY) as ThemeMode | null) ?? "system") === "system") {
        apply("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const select = (next: ThemeMode) => {
    setMode(next);
    localStorage.setItem(KEY, next);
    apply(next);
  };

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {MODES.map(({ id, Icon }) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            aria-label={t.theme[id]}
            title={t.theme[id]}
            onClick={() => select(id)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ${
              selected
                ? "bg-accent-soft text-accent"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
