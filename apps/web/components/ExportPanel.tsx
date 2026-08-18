"use client";

import { exportPixelSize } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";
import { IconAlert, IconCheck, IconDownload } from "./icons";

export function ExportPanel() {
  const format = usePhotoStore((s) => s.format());
  const solution = usePhotoStore((s) => s.solution);
  const exporting = usePhotoStore((s) => s.exporting);
  const exportResult = usePhotoStore((s) => s.exportResult);
  const exportPhoto = usePhotoStore((s) => s.exportPhoto);
  const clearExport = usePhotoStore((s) => s.clearExport);

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

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={exporting || blocked}
          onClick={() => void exportPhoto({ mimeType: "image/jpeg" })}
        >
          <IconDownload className="h-4 w-4" />
          {exporting ? "Preparing…" : "Download JPEG"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={exporting || blocked}
          onClick={() => void exportPhoto({ mimeType: "image/png" })}
        >
          PNG
        </button>
      </div>

      {format.digital_spec && (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={exporting || blocked}
          onClick={() => void exportPhoto({ digital: true })}
        >
          Online-application file · {format.digital_spec.width_px} ×{" "}
          {format.digital_spec.height_px} px, max{" "}
          {Math.round(format.digital_spec.max_bytes / 1024)} KB
        </button>
      )}

      {blocked && (
        <p className="flex items-start gap-2 text-sm leading-snug text-danger">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <IconAlert className="h-3 w-3" strokeWidth={2.5} />
          </span>
          Fix the checks above before downloading — this crop would be rejected.
        </p>
      )}

      {exportResult && (
        <div className="space-y-3 rounded-control border border-ok-border bg-ok-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ok">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ok text-white">
              <IconCheck className="h-3 w-3" strokeWidth={2.75} />
            </span>
            Your photo is ready.
          </p>
          <p className="tabular-nums text-xs text-ink-muted">
            {exportResult.width} × {exportResult.height} px ·{" "}
            {exportResult.dpi} DPI · {(exportResult.bytes / 1024).toFixed(0)} KB
          </p>
          <div className="flex flex-col gap-2">
            <a
              className="btn-primary"
              href={exportResult.url}
              download={exportResult.filename}
            >
              <IconDownload className="h-4 w-4" />
              Save {exportResult.filename}
            </a>
            <button type="button" className="btn-ghost" onClick={clearExport}>
              Keep editing
            </button>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            Printing at a drugstore: the file carries its physical size, so
            choose “actual size” / “no scaling” when printing. A print-sheet
            layout (6 photos on 10 × 15 cm) is coming in the next release.
          </p>
        </div>
      )}
    </section>
  );
}
