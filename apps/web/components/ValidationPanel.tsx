"use client";

import type { ValidationLevel } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";

const LEVEL_STYLES: Record<ValidationLevel, string> = {
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  error: "bg-danger-soft text-danger border-danger/20",
};

const LEVEL_ICON: Record<ValidationLevel, string> = {
  ok: "✓",
  warn: "!",
  error: "×",
};

const LEVEL_HEADLINE: Record<ValidationLevel, string> = {
  ok: "Ready to download",
  warn: "Usable, with warnings",
  error: "Not within spec",
};

export function ValidationPanel() {
  const adjust = usePhotoStore((s) => s.adjust);
  const formatId = usePhotoStore((s) => s.formatId);
  const faceIndex = usePhotoStore((s) => s.faceIndex);
  const solution = usePhotoStore((s) => s.solution());
  const format = usePhotoStore((s) => s.format());
  const resetAdjust = usePhotoStore((s) => s.resetAdjust);

  // adjust/formatId/faceIndex are read so the panel re-renders on every change.
  void adjust;
  void formatId;
  void faceIndex;

  if (!solution) return null;

  return (
    <section aria-label="Photo checks" className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${LEVEL_STYLES[solution.level]}`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden className="text-base leading-none">
          {LEVEL_ICON[solution.level]}
        </span>
        {LEVEL_HEADLINE[solution.level]}
      </div>

      <ul className="space-y-1.5 text-sm">
        {solution.validations.map((item) => (
          <li key={item.id} className="flex gap-2">
            <span
              aria-hidden
              className={
                item.level === "ok"
                  ? "text-ok"
                  : item.level === "warn"
                    ? "text-warn"
                    : "text-danger"
              }
            >
              {LEVEL_ICON[item.level]}
            </span>
            <span className="text-ink-muted">{item.message}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-secondary w-full" onClick={resetAdjust}>
        Reset to auto crop
      </button>

      <p className="text-xs text-ink-faint">
        Spec last checked {format.verified_date}
        {format.verification_status === "seeded" && " (not yet re-verified)"}.
        Always confirm the requirements with the issuing authority.
      </p>
    </section>
  );
}
