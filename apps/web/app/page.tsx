"use client";

import { useEffect } from "react";
import { findFormat, formatLabel } from "@photomaker/core";
import { AdjustPanel } from "../components/AdjustPanel";
import { BackgroundPanel } from "../components/BackgroundPanel";
import { Editor } from "../components/Editor";
import { ExportPanel } from "../components/ExportPanel";
import { FamilyPanel } from "../components/FamilyPanel";
import { FormatPicker } from "../components/FormatPicker";
import { RetouchPanel } from "../components/RetouchPanel";
import { SheetPanel } from "../components/SheetPanel";
import { StatusBanner } from "../components/StatusBanner";
import { Uploader } from "../components/Uploader";
import { IconCheck, IconLock, LogoMark } from "../components/icons";
import { LanguagePicker } from "../components/LanguagePicker";
import { ThemeToggle } from "../components/ThemeToggle";
import { initLocale, useT, type Dict } from "../lib/i18n";
import {
  usePhotoStore,
  type AdjustTab,
  type DownloadTab,
  type ShellStep,
} from "../lib/store";

const STEP_IDS = ["format", "photo", "adjust", "download"] as const;

/** Where the stepper highlight sits for a given shell step. */
const STEP_INDEX: Record<ShellStep, number> = { format: 0, adjust: 2, download: 3 };

function Tabs<Id extends string>({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: { id: Id; label: string; dot?: boolean }[];
  active: Id;
  onSelect: (id: Id) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-line">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.id)}
            className={`relative min-h-[42px] flex-1 px-1 text-xs transition-colors duration-150 ${
              selected
                ? "-mb-px border-b-2 border-accent font-semibold text-accent"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.dot && (
              <span
                aria-hidden
                className="absolute end-[12%] top-2 h-1.5 w-1.5 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** One-line format summary (§app-shell redline C) — the picker moved to step ①. */
function FormatChip({ t }: { t: Dict }) {
  const format = usePhotoStore((s) => s.format());
  const setStep = usePhotoStore((s) => s.setStep);
  const { locale } = useT();
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-4 py-2.5 text-[13px] shadow-card">
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{formatLabel(format, locale)}</b>{" "}
        <span className="text-ink-muted">
          · {format.width_mm} × {format.height_mm} mm
        </span>
      </span>
      <button
        type="button"
        onClick={() => setStep("format")}
        className="shrink-0 text-xs font-medium text-accent hover:underline"
      >
        {t.shell.change}
      </button>
    </div>
  );
}

function AdjustView({ t }: { t: Dict }) {
  const tab = usePhotoStore((s) => s.view.adjustTab);
  const setAdjustTab = usePhotoStore((s) => s.setAdjustTab);
  const hasMatte = usePhotoStore((s) => Boolean(s.mask && s.background.fill));
  const hasRetouch = usePhotoStore(
    (s) => s.retouch.ops.length > 0 || s.retouch.attire !== null,
  );
  return (
    <section className="card overflow-hidden">
      <Tabs<AdjustTab>
        label={t.steps.adjust}
        active={tab}
        onSelect={setAdjustTab}
        tabs={[
          { id: "crop", label: t.shell.crop },
          { id: "background", label: t.bg.eyebrow, dot: hasMatte },
          { id: "retouch", label: t.retouch.eyebrow, dot: hasRetouch },
        ]}
      />
      <div className="p-5">
        {tab === "crop" && <AdjustPanel />}
        {tab === "background" && <BackgroundPanel />}
        {tab === "retouch" && <RetouchPanel />}
      </div>
    </section>
  );
}

function DownloadView({ t }: { t: Dict }) {
  const tab = usePhotoStore((s) => s.view.downloadTab);
  const setDownloadTab = usePhotoStore((s) => s.setDownloadTab);
  const hasBatch = usePhotoStore((s) => s.batch.length > 0);
  return (
    <section className="card overflow-hidden">
      <Tabs<DownloadTab>
        label={t.steps.download}
        active={tab}
        onSelect={setDownloadTab}
        tabs={[
          { id: "photo", label: t.steps.photo },
          { id: "sheet", label: t.sheet.eyebrow },
          { id: "family", label: t.family.eyebrow, dot: hasBatch },
        ]}
      />
      <div className="p-5">
        {tab === "photo" && <ExportPanel />}
        {tab === "sheet" && <SheetPanel />}
        {tab === "family" && <FamilyPanel />}
      </div>
    </section>
  );
}

export default function Home() {
  const status = usePhotoStore((s) => s.status);
  const stage = usePhotoStore((s) => s.stage());
  const view = usePhotoStore((s) => s.view);
  const setStep = usePhotoStore((s) => s.setStep);
  const hasBatch = usePhotoStore((s) => s.batch.length > 0);
  const reset = usePhotoStore((s) => s.reset);
  const ready = status === "ready";
  const { t } = useT();

  // Before a photo is ready the stepper mirrors progress, as before; once
  // ready it mirrors (and drives) the shell's view.
  const stageIndex = ready
    ? STEP_INDEX[view.step]
    : STEP_IDS.indexOf(stage === "download" ? "adjust" : stage);

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

      <ol aria-label="Progress" className="mb-7 flex items-center gap-2 sm:gap-3">
        {STEP_IDS.map((stepId, index) => {
          const current = index === stageIndex;
          const done = index < stageIndex;
          // Once ready, Format / Adjust / Download navigate (redline D);
          // "Photo" stays a marker — replacing the photo is an explicit button.
          const target: ShellStep | null =
            ready && stepId !== "photo" ? (stepId as ShellStep) : null;
          const marker = (
            <>
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
            </>
          );
          return (
            <li
              key={stepId}
              className="flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:gap-3"
            >
              {target ? (
                <button
                  type="button"
                  aria-current={current ? "step" : undefined}
                  onClick={() => setStep(target)}
                  className="flex shrink-0 items-center gap-2 rounded-full"
                >
                  {marker}
                </button>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className="flex shrink-0 items-center gap-2"
                >
                  {marker}
                </span>
              )}
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
                  {t.hintIntro} <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd>{" "}
                  {t.hintPan} <kbd>+</kbd> <kbd>−</kbd> {t.hintZoom}
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

        <aside className="space-y-4">
          {ready ? (
            <>
              <StatusBanner />
              <FormatChip t={t} />
              {view.step === "format" && (
                <section className="card p-5">
                  <p className="eyebrow mb-4">{t.steps.format}</p>
                  <FormatPicker />
                </section>
              )}
              {view.step === "adjust" && <AdjustView t={t} />}
              {view.step === "download" && <DownloadView t={t} />}
            </>
          ) : (
            <>
              <section className="card p-5">
                <p className="eyebrow">{t.steps.format}</p>
                <FormatHeading />
                <FormatPicker />
              </section>
              {hasBatch && (
                <section className="card p-5">
                  <FamilyPanel />
                </section>
              )}
            </>
          )}
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

function FormatHeading() {
  const format = usePhotoStore((s) => s.format());
  const { locale } = useT();
  return (
    <h2 className="mb-4 mt-1 text-sm font-semibold">
      {formatLabel(format, locale)} · {format.width_mm} × {format.height_mm} mm
    </h2>
  );
}
