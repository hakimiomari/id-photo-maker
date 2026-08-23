"use client";

import { useState } from "react";
import type { ValidationItem, ValidationLevel } from "@photomaker/core";
import { localizeCheck, useT, type Dict } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";
import { IconAlert, IconCheck, IconReset, IconX } from "./icons";

export const BANNER: Record<ValidationLevel, string> = {
  ok: "border-ok-border bg-ok-soft text-ok",
  warn: "border-warn-border bg-warn-soft text-warn",
  error: "border-danger-border bg-danger-soft text-danger",
};

const DOT: Record<ValidationLevel, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-danger",
};

/**
 * What no heuristic can see (§4.6): the user ticks these off themselves.
 * Deliberately short — a long list gets skipped wholesale.
 */
const MANUAL_CHECK_IDS = ["recent", "glasses", "headwear", "hair", "clothing"] as const;

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

function CheckList({ items, t }: { items: ValidationItem[]; t: Dict }) {
  const format = usePhotoStore((s) => s.format());
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const localized = localizeCheck(item, t, format);
        return (
          <li key={item.id} className="flex items-start gap-2.5">
            <span className="mt-px">
              <LevelGlyph level={item.level} />
            </span>
            <span className="min-w-0 text-[13px] leading-snug text-ink-muted">
              {localized.message}
              {item.level !== "ok" && localized.hint && (
                <span className="mt-0.5 block text-xs leading-snug text-ink-faint">
                  {localized.hint}
                </span>
              )}
            </span>
          </li>
        );
      })}
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

function ManualChecklist({ t }: { t: Dict }) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const remaining = MANUAL_CHECK_IDS.length - ticked.size;

  return (
    <details className="group rounded-control border border-line bg-canvas px-3.5 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-ink marker:content-none">
        <span>{t.checks.beforeSubmit}</span>
        <span className="text-xs font-normal tabular-nums text-ink-faint">
          {remaining === 0 ? t.checks.allConfirmed : t.checks.toConfirm(remaining)}
        </span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        {t.checks.manualIntro}
      </p>
      <ul className="mt-2.5 space-y-2">
        {MANUAL_CHECK_IDS.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-ink-muted">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                checked={ticked.has(id)}
                onChange={() => toggle(id)}
              />
              <span className={ticked.has(id) ? "text-ink-faint line-through" : ""}>
                {t.checks.manual[id]}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Worst of framing + compliance — the shell's status banner reads this too. */
export function useOverallLevel(): ValidationLevel | null {
  const solution = usePhotoStore((s) => s.solution);
  const compliance = usePhotoStore((s) => s.compliance);
  if (!solution) return null;
  return worst(solution.level, compliance?.level);
}

export { LevelGlyph };

export function ValidationPanel() {
  // `solution` and `compliance` are derived state, so their identities change
  // whenever the crop, format, selected face or scan does — no extra
  // subscriptions needed.
  const solution = usePhotoStore((s) => s.solution);
  const compliance = usePhotoStore((s) => s.compliance);
  const metricsPending = usePhotoStore((s) => s.metricsPending);
  const format = usePhotoStore((s) => s.format());
  const resetAdjust = usePhotoStore((s) => s.resetAdjust);
  const { t } = useT();

  if (!solution) return null;

  return (
    <section aria-label={t.checks.eyebrow} className="space-y-4">
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-ink">{t.checks.framing}</h3>
        <CheckList items={solution.validations} t={t} />
      </div>

      {compliance && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-ink">{t.checks.quality}</h3>
          <CheckList items={compliance.checks} t={t} />
          {metricsPending && <Pending label={t.checks.scanning} />}
        </div>
      )}

      <ManualChecklist t={t} />

      <button type="button" className="btn-secondary w-full" onClick={resetAdjust}>
        <IconReset className="h-4 w-4" />
        {t.checks.reset}
      </button>

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
        {t.checks.specNote(
          format.verified_date,
          format.verification_status === "seeded",
        )}
      </p>
    </section>
  );
}
