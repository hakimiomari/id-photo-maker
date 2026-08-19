"use client";

import { usePhotoStore, type ExportResult } from "../lib/store";
import { formatBytes } from "../lib/bytes";
import { IconCheck, IconDownload } from "./icons";

/**
 * The finished-file card. Rendered inside the panel whose button produced the
 * file — feedback appears exactly where the user clicked, no scrolling. Each
 * panel passes the result kinds it owns.
 */
export function ExportResultCard({ kinds }: { kinds: ExportResult["kind"][] }) {
  const exportResult = usePhotoStore((s) => s.exportResult);
  const clearExport = usePhotoStore((s) => s.clearExport);

  if (!exportResult || !kinds.includes(exportResult.kind)) return null;
  const sheet = exportResult.kind === "sheet";

  return (
    <div className="space-y-3 rounded-control border border-ok-border bg-ok-soft p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ok">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ok text-surface">
          <IconCheck className="h-3 w-3" strokeWidth={2.75} />
        </span>
        {sheet ? "Your print sheet is ready." : "Your photo is ready."}
      </p>
      <p className="tabular-nums text-xs text-ink-muted">
        {sheet
          ? `${exportResult.copies} photos · ${exportResult.width} × ${exportResult.height} mm · ${formatBytes(exportResult.bytes)}`
          : `${exportResult.width} × ${exportResult.height} px · ${exportResult.dpi} DPI · ${formatBytes(exportResult.bytes)}`}
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
        {sheet
          ? "Order this as a normal photo print, then cut along the marks. Choose “actual size” when printing — never “fit to page”."
          : "The file carries its physical size — choose “actual size” / “no scaling” when printing. For the cheapest prints, use the print sheet below."}
      </p>
    </div>
  );
}
