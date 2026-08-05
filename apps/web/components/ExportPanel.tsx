"use client";

import { exportPixelSize } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";

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
    <section aria-label="Download" className="space-y-3">
      <div className="text-sm text-ink-muted">
        Print file: {target.width} × {target.height} px at {format.target_dpi} DPI
        {" — "}
        prints at exactly {format.width_mm} × {format.height_mm} mm.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={exporting || blocked}
          onClick={() => void exportPhoto({ mimeType: "image/jpeg" })}
        >
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
          Download online-application file ({format.digital_spec.width_px} ×{" "}
          {format.digital_spec.height_px} px, max{" "}
          {Math.round(format.digital_spec.max_bytes / 1024)} KB)
        </button>
      )}

      {blocked && (
        <p className="text-sm text-danger">
          Fix the checks above before downloading — this crop would be rejected.
        </p>
      )}

      {exportResult && (
        <div className="space-y-2 rounded-lg border border-ok/20 bg-ok-soft p-3">
          <p className="text-sm font-medium text-ok">Your photo is ready.</p>
          <p className="text-xs text-ink-muted">
            {exportResult.width} × {exportResult.height} px ·{" "}
            {exportResult.dpi} DPI · {(exportResult.bytes / 1024).toFixed(0)} KB
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              className="btn-primary flex-1"
              href={exportResult.url}
              download={exportResult.filename}
            >
              Save {exportResult.filename}
            </a>
            <button type="button" className="btn-secondary" onClick={clearExport}>
              Keep editing
            </button>
          </div>
          <p className="text-xs text-ink-muted">
            Printing at a drugstore: the file carries its physical size, so
            choose “actual size” / “no scaling” when printing. A print-sheet
            layout (6 photos on 10 × 15 cm) is coming in the next release.
          </p>
        </div>
      )}
    </section>
  );
}
