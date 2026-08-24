"use client";

import { useState } from "react";
import { useT } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";
import { BANNER, LevelGlyph, ValidationPanel, useOverallLevel } from "./ValidationPanel";
import { IconChevronDown } from "./icons";

/**
 * The shell's persistent verdict (§app-shell redline A): checks are state,
 * not a tool, so the banner stays visible above every tab and expands into
 * the full checks list on tap.
 */
export function StatusBanner() {
  const [open, setOpen] = useState(false);
  const level = useOverallLevel();
  const metricsPending = usePhotoStore((s) => s.metricsPending);
  const { t } = useT();

  if (!level) return null;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t.shell.checksAria}
        onClick={() => setOpen((previous) => !previous)}
        className={`flex w-full items-center gap-2.5 px-4 py-3 text-start text-sm font-semibold ${BANNER[level]}`}
      >
        <LevelGlyph level={level} />
        <span className="min-w-0 flex-1 truncate">{t.checks.headline[level]}</span>
        {metricsPending && (
          <span
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 animate-pulse rounded-full border-2 border-current opacity-50"
          />
        )}
        <IconChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <ValidationPanel />
        </div>
      )}
    </div>
  );
}
