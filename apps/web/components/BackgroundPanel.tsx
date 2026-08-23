"use client";

import type { CSSProperties } from "react";
import { useT } from "../lib/i18n";
import { requiredFill, usePhotoStore } from "../lib/store";
import { IconCheck } from "./icons";

/**
 * Background removal & replacement (§5.3). The format's required colour is
 * preselected; everything runs on-device via the segment worker.
 */

const PRESETS = [
  { id: "#FFFFFF", key: "presetWhite" },
  { id: "#F0F0F0", key: "presetLightGrey" },
  { id: "#FAFAF7", key: "presetOffWhite" },
] as const;

export function BackgroundPanel() {
  const format = usePhotoStore((s) => s.format());
  const solution = usePhotoStore((s) => s.solution);
  const mask = usePhotoStore((s) => s.mask);
  const segmenting = usePhotoStore((s) => s.segmenting);
  const background = usePhotoStore((s) => s.background);
  const removeBackground = usePhotoStore((s) => s.removeBackground);
  const clearBackground = usePhotoStore((s) => s.clearBackground);
  const setBackgroundFill = usePhotoStore((s) => s.setBackgroundFill);
  const setFeather = usePhotoStore((s) => s.setFeather);
  const toggleOriginal = usePhotoStore((s) => s.toggleOriginal);
  const { t } = useT();

  if (!solution) return null;

  const autoFill = requiredFill(format.background);
  const isPreset = PRESETS.some((p) => p.id === background.fill);
  const customActive =
    background.fill !== null && background.fill !== autoFill && !isPreset;

  const chip = (selected: boolean) =>
    `rounded-control border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
      selected
        ? "border-accent bg-accent-soft text-accent"
        : "border-line bg-surface text-ink-muted hover:border-line-strong"
    }`;

  return (
    <section aria-label="Background" className="space-y-4">
      <p className="eyebrow">{t.bg.eyebrow}</p>

      {!mask ? (
        <>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t.bg.desc}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={segmenting}
            onClick={() => void removeBackground()}
          >
            {segmenting ? t.bg.detecting : t.bg.remove}
          </button>
          <p className="text-xs leading-relaxed text-ink-faint">
            {t.bg.modelNote}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Background colour">
            <button
              type="button"
              aria-pressed={background.fill === autoFill}
              onClick={() => setBackgroundFill(autoFill)}
              className={chip(background.fill === autoFill)}
            >
              {t.bg.requiredChip(t.bgNames[format.background] ?? t.bgNames.white!)}
            </button>
            {PRESETS.filter((p) => p.id !== autoFill).map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={background.fill === preset.id}
                onClick={() => setBackgroundFill(preset.id)}
                className={chip(background.fill === preset.id)}
              >
                {t.bg[preset.key]}
              </button>
            ))}
            <label className={`${chip(customActive)} inline-flex cursor-pointer items-center gap-1.5`}>
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-line-strong"
                style={{ background: customActive ? background.fill! : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
              />
              {t.bg.custom}
              <input
                type="color"
                className="sr-only"
                value={customActive ? background.fill! : "#FFFFFF"}
                onChange={(event) => setBackgroundFill(event.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-muted">{t.bg.softness}</span>
              <span className="tabular-nums text-xs font-semibold text-ink">
                {background.feather} px
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={background.feather}
              onChange={(event) => setFeather(Number(event.target.value))}
              className="slider"
              style={{ "--fill": `${(background.feather / 3) * 100}%` } as CSSProperties}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={background.showOriginal}
              onClick={toggleOriginal}
              className={`${chip(background.showOriginal)} flex-1`}
            >
              {background.showOriginal ? t.bg.showingOriginal : t.bg.showOriginal}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={clearBackground}
            >
              {t.bg.keepOriginal}
            </button>
          </div>

          <p className="inline-flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
            <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
            {t.bg.crownNote}
          </p>
        </>
      )}
    </section>
  );
}
