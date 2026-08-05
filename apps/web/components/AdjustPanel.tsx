"use client";

import { usePhotoStore } from "../lib/store";

const SLIDERS = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
] as const;

export function AdjustPanel() {
  const image = usePhotoStore((s) => s.image);
  const setImageAdjustments = usePhotoStore((s) => s.setImageAdjustments);
  const zoomBy = usePhotoStore((s) => s.zoomBy);

  return (
    <section aria-label="Adjustments" className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => zoomBy(1 / 1.05)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => zoomBy(1.05)}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {SLIDERS.map(({ key, label }) => (
        <label key={key} className="block text-sm">
          <span className="mb-1 flex justify-between text-ink-muted">
            {label}
            <span className="tabular-nums">{Math.round(image[key] * 100)}%</span>
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
            className="w-full accent-accent"
          />
        </label>
      ))}

      <p className="text-xs text-ink-faint">
        Keep edits subtle. Many authorities reject retouched or heavily filtered
        photos.
      </p>
    </section>
  );
}
