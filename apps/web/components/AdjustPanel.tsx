"use client";

import type { CSSProperties } from "react";
import { useT } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";

const SLIDERS = ["brightness", "contrast", "saturation"] as const;

export function AdjustPanel() {
  const image = usePhotoStore((s) => s.image);
  const setImageAdjustments = usePhotoStore((s) => s.setImageAdjustments);
  const zoomBy = usePhotoStore((s) => s.zoomBy);
  const { t } = useT();

  return (
    <section aria-label={t.adjust.eyebrow} className="space-y-4">
      <p className="eyebrow">{t.adjust.eyebrow}</p>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => zoomBy(1 / 1.05)}
          aria-label={t.adjust.zoomOut}
        >
          −
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => zoomBy(1.05)}
          aria-label={t.adjust.zoomIn}
        >
          +
        </button>
      </div>

      {SLIDERS.map((key) => {
        const percent = Math.round(image[key] * 100);
        const fill = ((image[key] - 0.6) / 0.8) * 100;
        return (
          <label key={key} className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-muted">{t.adjust[key]}</span>
              <span className="tabular-nums text-xs font-semibold text-ink">
                {percent}%
              </span>
            </span>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.01}
              value={image[key]}
              onChange={(event) =>
                setImageAdjustments({ [key]: Number(event.target.value) })
              }
              className="slider"
              style={{ "--fill": `${fill}%` } as CSSProperties}
            />
          </label>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-faint">{t.adjust.subtle}</p>
    </section>
  );
}
