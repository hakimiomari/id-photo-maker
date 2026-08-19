"use client";

import { useEffect, useState } from "react";
import { exportPixelSize } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";
import { formatBytes } from "../lib/bytes";
import { ExportResultCard } from "./ResultCard";
import { IconAlert, IconDownload } from "./icons";

export function ExportPanel() {
  const format = usePhotoStore((s) => s.format());
  const solution = usePhotoStore((s) => s.solution);
  const exporting = usePhotoStore((s) => s.exporting);
  const exportPhoto = usePhotoStore((s) => s.exportPhoto);

  // Same pattern as the sheet panel: chips select the file type, one button acts.
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png">("image/jpeg");
  const [pending, setPending] = useState<"photo" | "digital" | null>(null);
  useEffect(() => {
    if (!exporting) setPending(null);
  }, [exporting]);

  if (!solution) return null;

  const blocked = solution.level === "error";
  const target = exportPixelSize(format.width_mm, format.height_mm, format.target_dpi);

  return (
    <section aria-label="Download" className="space-y-4">
      <p className="eyebrow">Download</p>

      <dl className="space-y-1.5 rounded-control bg-canvas px-3.5 py-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-faint">Print file</dt>
          <dd className="tabular-nums font-medium text-ink">
            {target.width} × {target.height} px · {format.target_dpi} DPI
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-faint">Prints at exactly</dt>
          <dd className="tabular-nums font-medium text-ink">
            {format.width_mm} × {format.height_mm} mm
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="File type">
        {(
          [
            { id: "image/jpeg", label: "JPEG · recommended" },
            { id: "image/png", label: "PNG" },
          ] as const
        ).map(({ id, label }) => {
          const selected = mimeType === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => setMimeType(id)}
              className={`rounded-control border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-muted hover:border-line-strong"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        disabled={exporting || blocked}
        onClick={() => {
          setPending("photo");
          void exportPhoto({ mimeType });
        }}
      >
        <IconDownload className="h-4 w-4" />
        {pending === "photo"
          ? "Preparing…"
          : `Download photo (${mimeType === "image/png" ? "PNG" : "JPEG"})`}
      </button>

      {format.digital_spec && (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={exporting || blocked}
          onClick={() => {
            setPending("digital");
            void exportPhoto({ digital: true });
          }}
        >
          {pending === "digital"
            ? "Preparing…"
            : `Online-application file · ${format.digital_spec.width_px} × ${format.digital_spec.height_px} px, max ${formatBytes(format.digital_spec.max_bytes)}`}
        </button>
      )}

      {blocked && (
        <p className="flex items-start gap-2 text-sm leading-snug text-danger">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-surface">
            <IconAlert className="h-3 w-3" strokeWidth={2.5} />
          </span>
          Fix the checks above before downloading — this crop would be rejected.
        </p>
      )}

      <ExportResultCard kinds={["print", "digital"]} />
    </section>
  );
}
