"use client";

import type { CSSProperties } from "react";
import { usePhotoStore } from "../lib/store";

const SLIDERS = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
] as const;

const MIN = 0.6;
const MAX = 1.4;

export function AdjustPanel() {
  const image = usePhotoStore((s) => s.image);
  const setImageAdjustments = usePhotoStore((s) => s.setImageAdjustments);
  const zoomBy = usePhotoStore((s) => s.zoomBy);

  return (
    <section aria-label="Adjustments" className="space-y-4">
      <p className="eyebrow">Fine-tune</p>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1 text-base"
          onClick={() => zoomBy(1 / 1.05)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="btn-secondary flex-1 text-base"
          onClick={() => zoomBy(1.05)}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className="space-y-3.5">
        {SLIDERS.map(({ key, label }) => {
          const value = image[key];
          const fill = ((value - MIN) / (MAX - MIN)) * 100;
          return (
            <label key={key} className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink-muted">{label}</span>
                <span className="tabular-nums text-xs font-semibold text-ink">
                  {Math.round(value * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={MIN}
                max={MAX}
                step={0.01}
                value={value}
                onChange={(event) =>
                  setImageAdjustments({ [key]: Number(event.target.value) })
                }
                className="slider"
                style={{ "--fill": `${fill}%` } as CSSProperties}
              />
            </label>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Keep edits subtle. Many authorities reject retouched or heavily filtered
        photos.
      </p>
    </section>
  );
}
