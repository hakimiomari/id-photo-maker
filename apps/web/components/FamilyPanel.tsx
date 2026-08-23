"use client";

import { useMemo, useState } from "react";
import { assignCells, countsPerMember, getFormat, getPaper, layoutSheet, paperLabel } from "@photomaker/core";
import { useT } from "../lib/i18n";
import { MEMBER_DRAG_TYPE, usePhotoStore } from "../lib/store";
import { ExportResultCard } from "./ResultCard";
import { IconDownload, IconX } from "./icons";

/**
 * Family / batch mode (§9): finish one person's photo, add it, load the next.
 * Everyone shares one print sheet — the cheapest way to do a family's visa
 * applications. Rendered whenever there is a photo ready OR a batch going, so
 * the collected members stay visible while the next person's photo loads.
 */
export function FamilyPanel() {
  const solution = usePhotoStore((s) => s.solution);
  const batch = usePhotoStore((s) => s.batch);
  const batchBusy = usePhotoStore((s) => s.batchBusy);
  const exporting = usePhotoStore((s) => s.exporting);
  const paperId = usePhotoStore((s) => s.paperId);
  const formatId = usePhotoStore((s) => s.formatId);
  const addToBatch = usePhotoStore((s) => s.addToBatch);
  const removeBatchMember = usePhotoStore((s) => s.removeBatchMember);
  const clearBatch = usePhotoStore((s) => s.clearBatch);
  const exportFamilySheet = usePhotoStore((s) => s.exportFamilySheet);
  const reset = usePhotoStore((s) => s.reset);

  const [output, setOutput] = useState<"pdf" | "jpeg">("pdf");
  const { t, locale } = useT();

  const batchFormat = batch[0] ? getFormat(batch[0].formatId) : null;
  const formatMismatch = batchFormat !== null && batchFormat.id !== formatId;

  // What the sheet would hold for the current member count (pure math).
  const plan = useMemo(() => {
    if (!batchFormat || batch.length === 0) return null;
    try {
      const layout = layoutSheet(batchFormat, getPaper(paperId));
      const counts = countsPerMember(
        assignCells(layout.copies, batch.length),
        batch.length,
      );
      return { copies: layout.copies, counts };
    } catch {
      return null; // more people than cells, or format larger than paper
    }
  }, [batchFormat, batch.length, paperId]);

  if (!solution && batch.length === 0) return null;
  const busy = batchBusy || exporting;

  return (
    <section aria-label="Family sheet" className="space-y-4">
      <p className="eyebrow">{t.family.eyebrow}</p>

      {batch.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {t.family.intro}
        </p>
      ) : (
        <ul className="space-y-2">
          {batch.map((member) => (
            <li
              key={member.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(MEMBER_DRAG_TYPE, String(member.id));
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex cursor-grab items-center gap-3 rounded-control border border-line bg-surface p-2 active:cursor-grabbing"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={member.thumbUrl}
                alt=""
                className="h-12 w-auto rounded-[4px] border border-line"
              />
              <span className="flex-1 text-sm font-medium">{member.label}</span>
              {plan && (
                <span className="tabular-nums text-xs text-ink-faint">
                  ×{plan.counts[batch.indexOf(member)]}
                </span>
              )}
              <button
                type="button"
                aria-label={t.family.removePerson(member.label)}
                onClick={() => removeBatchMember(member.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-line/40 hover:text-ink"
              >
                <IconX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {solution && (
        <button
          type="button"
          className={batch.length === 0 ? "btn-secondary w-full" : "btn-secondary w-full"}
          disabled={busy || formatMismatch}
          onClick={() => void addToBatch()}
        >
          {batchBusy
            ? t.family.adding
            : batch.length === 0
              ? t.family.addFirst
              : t.family.addToo}
        </button>
      )}

      {formatMismatch && batchFormat && (
        <p className="text-xs leading-relaxed text-warn">
          {t.family.mismatch(batchFormat.label[locale] ?? batchFormat.label.en!)}
        </p>
      )}

      {batch.length > 0 && (
        <>
          {solution && (
            <button
              type="button"
              className="btn-ghost w-full text-xs"
              disabled={busy}
              onClick={reset}
            >
              {t.family.addAnother}
            </button>
          )}

          {plan ? (
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-ink">
                {t.family.people(batch.length)}
              </span>{" "}
              · {t.family.photosOn(plan.copies, paperLabel(getPaper(paperId), locale), plan.counts.join(" + "))}
            </p>
          ) : (
            <p className="text-[13px] text-warn">
              {t.family.noFit(batch.length, paperLabel(getPaper(paperId), locale))}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="File type">
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
            disabled={busy || !plan}
            onClick={() => void exportFamilySheet(output)}
          >
            <IconDownload className="h-4 w-4" />
            {batchBusy
              ? t.sheet.preparingSheet
              : t.family.downloadFamily(output.toUpperCase())}
          </button>

          <ExportResultCard kinds={["family"]} />

          <button
            type="button"
            className="btn-ghost w-full text-xs"
            disabled={busy}
            onClick={clearBatch}
          >
            {t.family.clear}
          </button>
        </>
      )}
    </section>
  );
}
