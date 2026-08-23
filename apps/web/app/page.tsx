"use client";

import { useEffect } from "react";
import { findFormat, formatLabel } from "@photomaker/core";
import { AdjustPanel } from "../components/AdjustPanel";
import { BackgroundPanel } from "../components/BackgroundPanel";
import { Editor } from "../components/Editor";
import { ExportPanel } from "../components/ExportPanel";
import { FamilyPanel } from "../components/FamilyPanel";
import { FormatPicker } from "../components/FormatPicker";
import { SheetPanel } from "../components/SheetPanel";
import { Uploader } from "../components/Uploader";
import { ValidationPanel } from "../components/ValidationPanel";
import { IconCheck, IconLock, LogoMark } from "../components/icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { initLocale, useT } from "../lib/i18n";
import { LanguagePicker } from "../components/LanguagePicker";
import { usePhotoStore } from "../lib/store";

const STEP_IDS = ["format", "photo", "adjust", "download"] as const;

function FamilyPanelCard() {
  // Outside the ready-only group: the collected family members must stay
  // visible while the next person's photo is being chosen.
  const hasBatch = usePhotoStore((s) => s.batch.length > 0);
  const ready = usePhotoStore((s) => s.status === "ready");
  if (!hasBatch && !ready) return null;
  return (
    <section className="card p-5">
      <FamilyPanel />
    </section>
  );
}

export default function Home() {
  const status = usePhotoStore((s) => s.status);
  const stage = usePhotoStore((s) => s.stage());
  const format = usePhotoStore((s) => s.format());
  const reset = usePhotoStore((s) => s.reset);
  const ready = status === "ready";
  const stageIndex = STEP_IDS.indexOf(stage);
  const { t, locale } = useT();

  // SEO pages deep-link into the editor with ?format=<id>&lang=<locale> (§8.3).
  useEffect(() => {
    initLocale();
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
              {t.tagline}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-ok-border bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok sm:inline-flex">
            <IconLock className="h-3.5 w-3.5" />
            {t.onDevicePill}
          </span>
          <LanguagePicker />
          <ThemeToggle />
        </div>
      </header>

      <ol
        aria-label="Progress"
        className="mb-7 flex items-center gap-2 sm:gap-3"
      >
        {STEP_IDS.map((stepId, index) => {
          const current = index === stageIndex;
          const done = index < stageIndex;
          return (
            <li key={stepId} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:gap-3">
              <span
                aria-current={current ? "step" : undefined}
                className="flex shrink-0 items-center gap-2"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200 ${
                    current
                      ? "bg-accent text-surface shadow-[0_1px_2px_rgba(15,23,42,0.2)]"
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
                  {t.steps[stepId]}
                </span>
              </span>
              {index < STEP_IDS.length - 1 && (
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
                  {t.hintIntro}{" "}
                  <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> {t.hintPan}{" "}
                  <kbd>+</kbd> <kbd>−</kbd> {t.hintZoom}
                </span>
                <button type="button" className="btn-secondary" onClick={reset}>
                  {t.useAnother}
                </button>
              </div>
            </>
          ) : (
            <Uploader />
          )}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <p className="eyebrow">{t.steps.format}</p>
            <h2 className="mb-4 mt-1 text-sm font-semibold">
              {formatLabel(format, locale)} · {format.width_mm} × {format.height_mm} mm
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
                <BackgroundPanel />
              </section>
              <section className="card p-5">
                <ExportPanel />
              </section>
              <section className="card p-5">
                <SheetPanel />
              </section>
            </>
          )}
          <FamilyPanelCard />
        </aside>
      </div>

      <footer className="mt-16 border-t border-line pt-6">
        <div className="flex flex-col gap-4 text-xs leading-relaxed text-ink-faint sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p>{t.footerDisclaimer}</p>
            <p>{t.footerGerman}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-ink-faint">
            <IconLock className="h-3.5 w-3.5" />
            {t.noUploadsFooter}
          </span>
        </div>
      </footer>
    </main>
  );
}
