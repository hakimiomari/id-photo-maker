"use client";

import { useState } from "react";
import type { ValidationItem, ValidationLevel } from "@photomaker/core";
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

/**
 * What no heuristic can see (§4.6): the user ticks these off themselves.
 * Deliberately short — a long list gets skipped wholesale.
 */
const MANUAL_CHECKS = [
  { id: "recent", label: "Taken within the last 6 months" },
  { id: "glasses", label: "No glare on glasses; eyes fully visible (some countries: no glasses at all)" },
  { id: "headwear", label: "No hat or head covering, unless worn daily for religious reasons" },
  { id: "hair", label: "Hair not covering the eyes or eyebrows" },
  { id: "clothing", label: "Everyday clothing — no uniform, and a colour that contrasts with the background" },
] as const;

function worst(...levels: Array<ValidationLevel | undefined>): ValidationLevel {
  if (levels.includes("error")) return "error";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

function LevelGlyph({ level }: { level: ValidationLevel }) {
  const Icon = level === "ok" ? IconCheck : level === "warn" ? IconAlert : IconX;
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-surface ${DOT[level]}`}
    >
      <Icon className="h-3 w-3" strokeWidth={2.75} />
    </span>
  );
}

function CheckList({ items }: { items: ValidationItem[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <span className="mt-px">
            <LevelGlyph level={item.level} />
          </span>
          <span className="min-w-0 text-[13px] leading-snug text-ink-muted">
            {item.message}
            {item.level !== "ok" && item.hint && (
              <span className="mt-0.5 block text-xs leading-snug text-ink-faint">
                {item.hint}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] text-ink-faint">
      <span
        aria-hidden
        className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-full border-2 border-line-strong"
      />
      {label}
    </p>
  );
}

function ManualChecklist() {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const remaining = MANUAL_CHECKS.length - ticked.size;

  return (
    <details className="group rounded-control border border-line bg-canvas px-3.5 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-ink marker:content-none">
        <span>Before you submit</span>
        <span className="text-xs font-normal tabular-nums text-ink-faint">
          {remaining === 0 ? "all confirmed" : `${remaining} to confirm`}
        </span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        These can&apos;t be checked automatically — confirm them yourself.
      </p>
      <ul className="mt-2.5 space-y-2">
        {MANUAL_CHECKS.map((check) => (
          <li key={check.id}>
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-ink-muted">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                checked={ticked.has(check.id)}
                onChange={() => toggle(check.id)}
              />
              <span className={ticked.has(check.id) ? "text-ink-faint line-through" : ""}>
                {check.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ValidationPanel() {
  // `solution` and `compliance` are derived state, so their identities change
  // whenever the crop, format, selected face or scan does — no extra
  // subscriptions needed.
  const solution = usePhotoStore((s) => s.solution);
  const compliance = usePhotoStore((s) => s.compliance);
  const metricsPending = usePhotoStore((s) => s.metricsPending);
  const format = usePhotoStore((s) => s.format());
  const resetAdjust = usePhotoStore((s) => s.resetAdjust);

  if (!solution) return null;

  const level = worst(solution.level, compliance?.level);

  return (
    <section aria-label="Photo checks" className="space-y-4">
      <p className="eyebrow">Checks</p>

      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2.5 rounded-control border px-3.5 py-2.5 text-sm font-semibold ${BANNER[level]}`}
      >
        <LevelGlyph level={level} />
        {HEADLINE[level]}
      </div>

      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-ink">Framing</h3>
        <CheckList items={solution.validations} />
      </div>

      {compliance && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-ink">Photo quality</h3>
          <CheckList items={compliance.checks} />
          {metricsPending && (
            <Pending label="Checking exposure, sharpness and background…" />
          )}
        </div>
      )}

      <ManualChecklist />

      <button type="button" className="btn-secondary w-full" onClick={resetAdjust}>
        <IconReset className="h-4 w-4" />
        Reset to auto crop
      </button>

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
        Spec last checked {format.verified_date}
        {format.verification_status === "seeded" && " (not yet re-verified)"}.
        Photo-quality checks are automatic estimates — always confirm the
        requirements with the issuing authority.
      </p>
    </section>
  );
}
