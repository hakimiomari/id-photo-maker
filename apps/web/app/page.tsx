"use client";

import { formatLabel } from "@photomaker/core";
import { AdjustPanel } from "../components/AdjustPanel";
import { Editor } from "../components/Editor";
import { ExportPanel } from "../components/ExportPanel";
import { FormatPicker } from "../components/FormatPicker";
import { Uploader } from "../components/Uploader";
import { ValidationPanel } from "../components/ValidationPanel";
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

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          ID Photo Maker
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Passport and ID photos, sized correctly for printing. Everything runs
          in your browser — your photo never leaves your device.
        </p>
      </header>

      <ol className="mb-6 flex items-center gap-2 text-xs" aria-label="Progress">
        {STEPS.map((step, index) => {
          const current = step.id === stage;
          const done = STEPS.findIndex((s) => s.id === stage) > index;
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                  current
                    ? "bg-accent text-white"
                    : done
                      ? "bg-accent-soft text-accent"
                      : "bg-surface text-ink-faint"
                }`}
              >
                <span className="tabular-nums">{index + 1}</span>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <span aria-hidden className="text-ink-faint">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {ready ? (
            <>
              <Editor />
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">
                  Drag to reposition · scroll or pinch to zoom · arrow keys work
                  too
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

        <aside className="space-y-6">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">
              {formatLabel(format)} · {format.width_mm} × {format.height_mm} mm
            </h2>
            <FormatPicker />
          </div>

          {ready && (
            <>
              <div className="card space-y-4 p-4">
                <ValidationPanel />
              </div>
              <div className="card p-4">
                <AdjustPanel />
              </div>
              <div className="card p-4">
                <ExportPanel />
              </div>
            </>
          )}
        </aside>
      </div>

      <footer className="mt-12 space-y-2 border-t border-line pt-6 text-xs text-ink-faint">
        <p>
          Not affiliated with any government. Always verify photo requirements
          with the issuing authority before submitting.
        </p>
        <p>
          German note: since 2025, photos for the Personalausweis and Reisepass
          must be transmitted digitally by a certified provider and cannot be
          produced with this app. Driving licence photos are still accepted on
          paper.
        </p>
      </footer>
    </main>
  );
}
