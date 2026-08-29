"use client";

import { useRef, type CSSProperties } from "react";
import { useT } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";
import { IconLock, IconReset, IconUpload, IconX } from "./icons";

/**
 * Manual retouching (Photoshop-style): heal brush, smoothing brush, and a
 * user-uploaded attire overlay. Locked on "strict" formats — biometric
 * authorities reject digitally altered photos, and this product's job is
 * photos that do not get rejected.
 */
export function RetouchPanel() {
  const format = usePhotoStore((s) => s.format());
  const solution = usePhotoStore((s) => s.solution);
  const retouch = usePhotoStore((s) => s.retouch);
  const setRetouchTool = usePhotoStore((s) => s.setRetouchTool);
  const setBrushRadius = usePhotoStore((s) => s.setBrushRadius);
  const setSmoothStrength = usePhotoStore((s) => s.setSmoothStrength);
  const setAttire = usePhotoStore((s) => s.setAttire);
  const setAttireTransform = usePhotoStore((s) => s.setAttireTransform);
  const removeAttire = usePhotoStore((s) => s.removeAttire);
  const undoRetouch = usePhotoStore((s) => s.undoRetouch);
  const clearRetouch = usePhotoStore((s) => s.clearRetouch);
  const clearSelection = usePhotoStore((s) => s.clearSelection);
  const setRegionEffect = usePhotoStore((s) => s.setRegionEffect);
  const setRegionStrength = usePhotoStore((s) => s.setRegionStrength);
  const setRegionFeather = usePhotoStore((s) => s.setRegionFeather);
  const applySelection = usePhotoStore((s) => s.applySelection);
  const workingSize = usePhotoStore((s) => s.workingSize);
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!solution) return null;

  if (format.retouch === "strict") {
    return (
      <section aria-label={t.retouch.eyebrow} className="space-y-3">
        <p className="eyebrow">{t.retouch.eyebrow}</p>
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
          <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          {t.retouch.lockedNote}
        </p>
      </section>
    );
  }

  const chip = (selected: boolean) =>
    `rounded-control border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
      selected
        ? "border-accent bg-accent-soft text-accent"
        : "border-line bg-surface text-ink-muted hover:border-line-strong"
    }`;

  const tool = retouch.tool;
  const brushMax = workingSize ? Math.round(workingSize.width / 12) : 60;

  return (
    <section aria-label={t.retouch.eyebrow} className="space-y-4">
      <p className="eyebrow">{t.retouch.eyebrow}</p>
      <p className="text-[13px] leading-relaxed text-ink-muted">{t.retouch.intro}</p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.retouch.eyebrow}>
        {(
          [
            { id: "none", label: t.retouch.off },
            { id: "heal", label: t.retouch.heal },
            { id: "smooth", label: t.retouch.smooth },
            { id: "select", label: t.retouch.select },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            onClick={() => setRetouchTool(id)}
            className={chip(tool === id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={tool === "attire"}
          onClick={() =>
            retouch.attire ? setRetouchTool("attire") : fileRef.current?.click()
          }
          className={chip(tool === "attire")}
        >
          {t.retouch.attire}
        </button>
      </div>

      {(tool === "heal" || tool === "smooth") && (
        <>
          <p className="text-xs leading-relaxed text-ink-faint">
            {tool === "heal" ? t.retouch.healHint : t.retouch.smoothHint}
          </p>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-muted">{t.retouch.brushSize}</span>
              <span className="tabular-nums text-xs font-semibold text-ink" dir="ltr">
                {retouch.brushRadius} px
              </span>
            </span>
            <input
              type="range"
              min={4}
              max={brushMax}
              step={1}
              value={retouch.brushRadius}
              onChange={(event) => setBrushRadius(Number(event.target.value))}
              className="slider"
              style={{ "--fill": `${((retouch.brushRadius - 4) / (brushMax - 4)) * 100}%` } as CSSProperties}
            />
          </label>
          {tool === "smooth" && (
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink-muted">{t.retouch.strength}</span>
                <span className="tabular-nums text-xs font-semibold text-ink">
                  {Math.round(retouch.smoothStrength * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={0.1}
                max={0.7}
                step={0.05}
                value={retouch.smoothStrength}
                onChange={(event) => setSmoothStrength(Number(event.target.value))}
                className="slider"
                style={{ "--fill": `${((retouch.smoothStrength - 0.1) / 0.6) * 100}%` } as CSSProperties}
              />
            </label>
          )}
        </>
      )}

      {tool === "select" && (
        <>
          <p className="text-xs leading-relaxed text-ink-faint">{t.retouch.selectHint}</p>
          <p className="text-[13px] font-medium text-ink-muted" role="status">
            {retouch.selection?.closed
              ? t.retouch.selectionClosed
              : t.retouch.selectionPoints(retouch.selection ? retouch.selection.points.length / 2 : 0)}
          </p>
          {retouch.selection?.closed && (
            <>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.retouch.select}>
                {(
                  [
                    { id: "darken", label: t.retouch.effectDarken },
                    { id: "smooth", label: t.retouch.effectSmooth },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={retouch.regionEffect === id}
                    onClick={() => setRegionEffect(id)}
                    className={chip(retouch.regionEffect === id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-ink-muted">{t.retouch.strength}</span>
                  <span className="tabular-nums text-xs font-semibold text-ink">
                    {Math.round(retouch.regionStrength * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={retouch.regionStrength}
                  onChange={(event) => setRegionStrength(Number(event.target.value))}
                  className="slider"
                  style={{ "--fill": `${((retouch.regionStrength - 0.1) / 0.9) * 100}%` } as CSSProperties}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-ink-muted">{t.retouch.feather}</span>
                  <span className="tabular-nums text-xs font-semibold text-ink" dir="ltr">
                    {retouch.regionFeather} px
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={retouch.regionFeather}
                  onChange={(event) => setRegionFeather(Number(event.target.value))}
                  className="slider"
                  style={{ "--fill": `${(retouch.regionFeather / 20) * 100}%` } as CSSProperties}
                />
              </label>
              <button type="button" className="btn-primary w-full" onClick={applySelection}>
                {t.retouch.applySelection}
              </button>
            </>
          )}
          {retouch.selection && (
            <button type="button" className="btn-ghost w-full text-xs" onClick={clearSelection}>
              <IconX className="h-3.5 w-3.5" />
              {t.retouch.clearSelection}
            </button>
          )}
        </>
      )}

      {tool === "attire" && retouch.attire && (
        <>
          <p className="text-xs leading-relaxed text-ink-faint">{t.retouch.attireHint}</p>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-muted">{t.retouch.attireWidth}</span>
            </span>
            <input
              type="range"
              min={workingSize ? workingSize.width * 0.1 : 50}
              max={workingSize ? workingSize.width * 1.2 : 1000}
              step={1}
              value={retouch.attire.transform.width}
              onChange={(event) => setAttireTransform({ width: Number(event.target.value) })}
              className="slider"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-muted">{t.retouch.attireRotation}</span>
              <span className="tabular-nums text-xs font-semibold text-ink" dir="ltr">
                {retouch.attire.transform.rotation}°
              </span>
            </span>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={retouch.attire.transform.rotation}
              onChange={(event) => setAttireTransform({ rotation: Number(event.target.value) })}
              className="slider"
            />
          </label>
          <button type="button" className="btn-ghost w-full text-xs" onClick={removeAttire}>
            <IconX className="h-3.5 w-3.5" />
            {t.retouch.removeAttire}
          </button>
        </>
      )}

      {!retouch.attire && tool !== "attire" && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload className="h-4 w-4" />
          {t.retouch.uploadAttire}
        </button>
      )}

      {(retouch.ops.length > 0 || retouch.attire) && (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs tabular-nums text-ink-faint">
            {t.retouch.editsApplied(retouch.ops.length)}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={retouch.ops.length === 0}
            onClick={undoRetouch}
          >
            <IconReset className="h-4 w-4" />
            {t.retouch.undo}
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={clearRetouch}>
            {t.retouch.clearAll}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void setAttire(file);
          event.target.value = "";
        }}
      />
    </section>
  );
}
