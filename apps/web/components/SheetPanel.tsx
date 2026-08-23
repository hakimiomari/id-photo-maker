"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPaper,
  layoutSheet,
  PAPERS,
  paperLabel,
  type SheetLayout,
} from "@photomaker/core";
import { useT } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";
import { ExportResultCard } from "./ResultCard";
import { IconDownload } from "./icons";

export function SheetPanel() {
  const format = usePhotoStore((s) => s.format());
  const solution = usePhotoStore((s) => s.solution);
  const paperId = usePhotoStore((s) => s.paperId);
  const setPaper = usePhotoStore((s) => s.setPaper);
  const exporting = usePhotoStore((s) => s.exporting);
  const exportSheet = usePhotoStore((s) => s.exportSheet);
  const { t, locale } = useT();

  // File type is a *selection* (like the paper chips above); one button acts.
  const [output, setOutput] = useState<"pdf" | "jpeg">("pdf");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!exporting) setPending(false);
  }, [exporting]);

  // Pure math on registry data — cheap enough to recompute per render.
  const layout = useMemo(() => {
    try {
      return layoutSheet(format, getPaper(paperId));
    } catch {
      return null; // photo larger than the paper
    }
  }, [format, paperId]);

  if (!solution) return null;
  const blocked = solution.level === "error";

  const run = () => {
    setPending(true);
    void exportSheet(output);
  };

  return (
    <section aria-label="Print sheet" className="space-y-4">
      <p className="eyebrow">{t.sheet.eyebrow}</p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.sheet.paperSize}>
        {PAPERS.map((paper) => {
          const selected = paper.id === paperId;
          return (
            <button
              key={paper.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPaper(paper.id)}
              className={`rounded-control border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-muted hover:border-line-strong"
              }`}
            >
              {paperLabel(paper, locale)}
            </button>
          );
        })}
      </div>

      {layout ? (
        <>
          <SheetPreview layout={layout} />
          <p className="text-[13px] text-ink-muted">
            <span className="font-semibold text-ink">{t.sheet.perSheet(layout.copies)}</span>{" "}
            {t.sheet.perSheetTail}
          </p>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="File type"
          >
            {(
              [
                { id: "pdf", labelKey: "pdfRec" },
                { id: "jpeg", labelKey: "jpeg" },
              ] as const
            ).map(({ id, labelKey }) => {
              const selected = output === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOutput(id)}
                  className={`rounded-control border px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                    selected
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink-muted hover:border-line-strong"
                  }`}
                >
                  {t.sheet[labelKey]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={exporting || blocked}
            onClick={run}
          >
            <IconDownload className="h-4 w-4" />
            {pending
              ? t.sheet.preparingSheet
              : t.sheet.downloadSheet(output.toUpperCase())}
          </button>

          <ExportResultCard kinds={["sheet"]} />
          <p className="text-xs leading-relaxed text-ink-faint">
            {t.sheet.help(paperLabel(getPaper(paperId), locale))}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          {t.sheet.noFit(paperLabel(getPaper(paperId), locale))}
        </p>
      )}
    </section>
  );
}

/** Miniature of the real layout — same math that renders the export. */
function SheetPreview({ layout }: { layout: SheetLayout }) {
  const scale = 150 / layout.sheetHeight_mm;
  const width = layout.sheetWidth_mm * scale;
  const height = 150;

  return (
    <div className="flex justify-center rounded-control bg-canvas py-3">
      <svg
        role="img"
        aria-label={`Sheet preview: ${layout.copies} photos on ${paperLabel(layout.paper)}`}
        width={width}
        height={height}
        viewBox={`0 0 ${layout.sheetWidth_mm} ${layout.sheetHeight_mm}`}
        className="rounded-[3px] shadow-card"
      >
        <rect
          width={layout.sheetWidth_mm}
          height={layout.sheetHeight_mm}
          fill="#FFFFFF"
          stroke="#D2D8E1"
          strokeWidth={0.4}
        />
        {layout.positions.map((position, index) => (
          <g key={index}>
            <rect
              x={position.x_mm}
              y={position.y_mm}
              width={layout.photoWidth_mm}
              height={layout.photoHeight_mm}
              fill="#EEF3FE"
              stroke="#B9CCF4"
              strokeWidth={0.4}
            />
            {/* head silhouette hint */}
            <circle
              cx={position.x_mm + layout.photoWidth_mm / 2}
              cy={position.y_mm + layout.photoHeight_mm * 0.38}
              r={layout.photoWidth_mm * 0.2}
              fill="#B9CCF4"
            />
            <path
              d={`M ${position.x_mm + layout.photoWidth_mm * 0.2} ${position.y_mm + layout.photoHeight_mm * 0.95}
                  Q ${position.x_mm + layout.photoWidth_mm / 2} ${position.y_mm + layout.photoHeight_mm * 0.55}
                  ${position.x_mm + layout.photoWidth_mm * 0.8} ${position.y_mm + layout.photoHeight_mm * 0.95} Z`}
              fill="#B9CCF4"
            />
          </g>
        ))}
        {layout.cutMarks.map((mark, index) => (
          <line
            key={index}
            x1={mark.x1_mm}
            y1={mark.y1_mm}
            x2={mark.x2_mm}
            y2={mark.y2_mm}
            stroke="#9EA6B0"
            strokeWidth={0.25}
          />
        ))}
      </svg>
    </div>
  );
}
