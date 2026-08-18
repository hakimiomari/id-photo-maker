"use client";

import { useEffect } from "react";
import { findFormat, formatLabel } from "@photomaker/core";
import { AdjustPanel } from "../components/AdjustPanel";
import { Editor } from "../components/Editor";
import { ExportPanel } from "../components/ExportPanel";
import { FormatPicker } from "../components/FormatPicker";
import { SheetPanel } from "../components/SheetPanel";
import { Uploader } from "../components/Uploader";
import { ValidationPanel } from "../components/ValidationPanel";
import { IconCheck, IconLock, LogoMark } from "../components/icons";
import { usePhotoStore } from "../lib/store";

const STEPS = [
  { id: "format", label: "Format" },
  { id: "photo", label: "Photo" },
  { id: "adjust", label: "Adjust" },
  { id: "download", label: "Download" },
] as const;

export default function Home() {
  const status = usePhotoStore((s) => s.status);
  const stage = usePhotoStore((s) => s.stage());
  const format = usePhotoStore((s) => s.format());
  const reset = usePhotoStore((s) => s.reset);
  const ready = status === "ready";
  const stageIndex = STEPS.findIndex((s) => s.id === stage);

  // SEO pages deep-link into the editor with ?format=<id> (§8.3).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("format");
    if (id && findFormat(id)) usePhotoStore.getState().setFormat(id);
  }, []);

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <LogoMark className="mt-0.5 h-10 w-10 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">
              ID Photo Maker
            </h1>
            <p className="mt-0.5 max-w-xl text-balance text-sm leading-relaxed text-ink-muted">
              Passport and ID photos, sized correctly for printing. Everything
              runs in your browser — your photo never leaves your device.
            </p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-ok-border bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok sm:inline-flex">
          <IconLock className="h-3.5 w-3.5" />
          100% on-device
        </span>
      </header>

      <ol
        aria-label="Progress"
        className="mb-7 flex items-center gap-2 sm:gap-3"
      >
        {STEPS.map((step, index) => {
          const current = index === stageIndex;
          const done = index < stageIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:gap-3">
              <span
                aria-current={current ? "step" : undefined}
                className="flex shrink-0 items-center gap-2"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200 ${
                    current
                      ? "bg-accent text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]"
                      : done
                        ? "bg-accent-soft text-accent"
                        : "border border-line-strong bg-surface text-ink-faint"
                  }`}
                >
                  {done ? <IconCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={`text-xs font-medium ${
                    current ? "text-ink" : done ? "text-ink-muted" : "text-ink-faint"
                  } ${current ? "" : "hidden sm:inline"}`}
                >
                  {step.label}
                </span>
              </span>
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px min-w-3 flex-1 ${done ? "bg-accent-border" : "bg-line-strong"}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {ready ? (
            <>
              <Editor />
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-faint">
                <span>
                  Drag to reposition · scroll or pinch to zoom ·{" "}
                  <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> pan,{" "}
                  <kbd>+</kbd> <kbd>−</kbd> zoom
                </span>
                <button type="button" className="btn-secondary" onClick={reset}>
                  Use another photo
                </button>
              </div>
            </>
          ) : (
            <Uploader />
          )}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <p className="eyebrow">Format</p>
            <h2 className="mb-4 mt-1 text-sm font-semibold">
              {formatLabel(format)} · {format.width_mm} × {format.height_mm} mm
            </h2>
            <FormatPicker />
          </section>

          {ready && (
            <>
              <section className="card p-5">
                <ValidationPanel />
              </section>
              <section className="card p-5">
                <AdjustPanel />
              </section>
              <section className="card p-5">
                <ExportPanel />
              </section>
              <section className="card p-5">
                <SheetPanel />
              </section>
            </>
          )}
        </aside>
      </div>

      <footer className="mt-16 border-t border-line pt-6">
        <div className="flex flex-col gap-4 text-xs leading-relaxed text-ink-faint sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p>
              Not affiliated with any government. Always verify photo
              requirements with the issuing authority before submitting.
            </p>
            <p>
              German note: since 2025, photos for the Personalausweis and
              Reisepass must be transmitted digitally by a certified provider
              and cannot be produced with this app. Driving licence photos are
              still accepted on paper.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-ink-faint">
            <IconLock className="h-3.5 w-3.5" />
            No uploads. No tracking of your photos.
          </span>
        </div>
      </footer>
    </main>
  );
}
