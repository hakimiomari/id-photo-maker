"use client";

import type { ValidationLevel } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";
import { IconAlert, IconCheck, IconReset, IconX } from "./icons";

const BANNER: Record<ValidationLevel, string> = {
  ok: "border-ok-border bg-ok-soft text-ok",
  warn: "border-warn-border bg-warn-soft text-warn",
  error: "border-danger-border bg-danger-soft text-danger",
};

const DOT: Record<ValidationLevel, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-danger",
};

const HEADLINE: Record<ValidationLevel, string> = {
  ok: "Ready to download",
  warn: "Usable, with warnings",
  error: "Not within spec",
};

function LevelGlyph({ level }: { level: ValidationLevel }) {
  const Icon = level === "ok" ? IconCheck : level === "warn" ? IconAlert : IconX;
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white ${DOT[level]}`}
    >
      <Icon className="h-3 w-3" strokeWidth={2.75} />
    </span>
  );
}

export function ValidationPanel() {
  // `solution` is derived state, so its identity changes whenever the crop,
  // format or selected face does — no extra subscriptions needed.
  const solution = usePhotoStore((s) => s.solution);
  const format = usePhotoStore((s) => s.format());
  const resetAdjust = usePhotoStore((s) => s.resetAdjust);

  if (!solution) return null;

  return (
    <section aria-label="Photo checks" className="space-y-4">
      <p className="eyebrow">Checks</p>

      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2.5 rounded-control border px-3.5 py-2.5 text-sm font-semibold ${BANNER[solution.level]}`}
      >
        <LevelGlyph level={solution.level} />
        {HEADLINE[solution.level]}
      </div>

      <ul className="space-y-2.5">
        {solution.validations.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <span className="mt-px">
              <LevelGlyph level={item.level} />
            </span>
            <span className="text-[13px] leading-snug text-ink-muted">
              {item.message}
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-secondary w-full" onClick={resetAdjust}>
        <IconReset className="h-4 w-4" />
        Reset to auto crop
      </button>

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
        Spec last checked {format.verified_date}
        {format.verification_status === "seeded" && " (not yet re-verified)"}.
        Always confirm the requirements with the issuing authority.
      </p>
    </section>
  );
}
