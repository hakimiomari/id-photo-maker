import Link from "next/link";
import {
  formatLabel,
  getPaper,
  layoutSheet,
  type PhotoFormat,
} from "@photomaker/core";
import { formatBytes } from "../lib/bytes";
import { IconCheck, IconLock, LogoMark } from "./icons";

/**
 * Shared server component behind the SEO landing pages (§8.3), rendered per
 * locale from /[slug] and /de/[slug]. Every number comes from the registry.
 */

export type Locale = "en" | "de";

const STRINGS = {
  en: {
    h1: (label: string, f: PhotoFormat) =>
      `${label} photo — ${f.width_mm} × ${f.height_mm} mm, free and in your browser`,
    intro: (label: string) =>
      `Upload a portrait and get a correctly sized, print-ready ${label} photo: automatic face detection, the official head-height ratio, and a full-resolution download with no watermark. Your photo never leaves your device.`,
    cta: "Open in the editor",
    ctaBottom: (f: PhotoFormat) => `Start with ${f.width_mm} × ${f.height_mm} mm`,
    onDevice: "100% on-device — no uploads",
    requirements: "Official requirements",
    photoSize: "Photo size",
    headHeight: "Head height (chin to crown)",
    eyeLine: "Eye line from bottom edge",
    background: "Background",
    resolution: "Print resolution",
    resolutionValue: (f: PhotoFormat) =>
      `${f.target_dpi} DPI (minimum ${f.min_dpi})`,
    digitalUpload: "Digital upload",
    perSheet: "Photos per 10 × 15 cm print",
    faqTitle: "Frequently asked questions",
    finalTitle: (label: string) => `Make your ${label} photo now`,
    finalSub: "Free, full resolution, no watermark, no sign-up. Works on your phone.",
    verified: (f: PhotoFormat) =>
      `Spec last checked ${f.verified_date}${f.verification_status === "seeded" ? " (not yet re-verified)" : ""}. Not affiliated with any government — always confirm the requirements with the issuing authority.`,
    source: "Official source",
    backgrounds: {
      white: "Plain white",
      light_grey: "Light grey (plain, even)",
      off_white: "Off-white",
      blue: "Blue",
      red: "Red",
      any: "No official requirement — plain and even is safest",
    } as Record<string, string>,
    faq: (label: string, f: PhotoFormat, copies: number) => [
      {
        q: `What size is a ${label} photo?`,
        a: `${f.width_mm} × ${f.height_mm} mm.${
          f.head_min_mm !== null && f.head_max_mm !== null
            ? ` The head, measured from chin to crown, must be ${f.head_min_mm}–${f.head_max_mm} mm tall.`
            : ""
        }`,
      },
      {
        q: "Can I make this photo online for free?",
        a: `Yes. This tool crops your photo to ${f.width_mm} × ${f.height_mm} mm with the correct head position, checks it against the size requirements, and gives you a full-resolution file with no watermark. All processing happens in your browser — the photo is never uploaded.`,
      },
      {
        q: "How do I print it cheaply?",
        a: `Download the print sheet: ${copies} photos arranged on a standard 10 × 15 cm print with cut marks. Order it as a normal photo print at any drugstore (usually under 1 €), then cut along the marks. Choose “actual size” when printing — never “fit to page”.`,
      },
      ...(f.digital_spec
        ? [
            {
              q: "Is there a version for online applications?",
              a: `Yes — the editor can also export a ${f.digital_spec.width_px} × ${f.digital_spec.height_px} px ${f.digital_spec.format.toUpperCase()} capped at ${formatBytes(f.digital_spec.max_bytes)}, matching the digital upload requirements.`,
            },
          ]
        : []),
    ],
  },
  de: {
    h1: (label: string, f: PhotoFormat) =>
      `${label} — ${f.width_mm} × ${f.height_mm} mm, kostenlos im Browser`,
    intro: (label: string) =>
      `Porträt hochladen und ein korrekt zugeschnittenes, druckfertiges Foto (${label}) erhalten: automatische Gesichtserkennung, vorschriftsmäßige Kopfhöhe und Download in voller Auflösung ohne Wasserzeichen. Ihr Foto verlässt nie Ihr Gerät.`,
    cta: "Im Editor öffnen",
    ctaBottom: (f: PhotoFormat) => `Mit ${f.width_mm} × ${f.height_mm} mm starten`,
    onDevice: "100 % auf Ihrem Gerät — keine Uploads",
    requirements: "Offizielle Anforderungen",
    photoSize: "Fotogröße",
    headHeight: "Kopfhöhe (Kinn bis Scheitel)",
    eyeLine: "Augenlinie vom unteren Rand",
    background: "Hintergrund",
    resolution: "Druckauflösung",
    resolutionValue: (f: PhotoFormat) =>
      `${f.target_dpi} DPI (mindestens ${f.min_dpi})`,
    digitalUpload: "Digitaler Upload",
    perSheet: "Fotos pro 10 × 15 cm Abzug",
    faqTitle: "Häufige Fragen",
    finalTitle: (label: string) => `Jetzt ${label} erstellen`,
    finalSub:
      "Kostenlos, volle Auflösung, kein Wasserzeichen, keine Anmeldung. Funktioniert auch am Handy.",
    verified: (f: PhotoFormat) =>
      `Vorgaben zuletzt geprüft am ${f.verified_date}${f.verification_status === "seeded" ? " (noch nicht erneut verifiziert)" : ""}. Keine Behörde — prüfen Sie die Anforderungen immer bei der ausstellenden Stelle.`,
    source: "Offizielle Quelle",
    backgrounds: {
      white: "Einfarbig weiß",
      light_grey: "Hellgrau (einfarbig, gleichmäßig)",
      off_white: "Cremeweiß",
      blue: "Blau",
      red: "Rot",
      any: "Keine offizielle Vorgabe — einfarbig und gleichmäßig ist am sichersten",
    } as Record<string, string>,
    faq: (label: string, f: PhotoFormat, copies: number) => [
      {
        q: `Welche Größe hat ein Foto „${label}“?`,
        a: `${f.width_mm} × ${f.height_mm} mm.${
          f.head_min_mm !== null && f.head_max_mm !== null
            ? ` Der Kopf muss, vom Kinn bis zum Scheitel gemessen, ${f.head_min_mm}–${f.head_max_mm} mm hoch sein.`
            : ""
        }`,
      },
      {
        q: "Kann ich das Foto kostenlos online erstellen?",
        a: `Ja. Dieses Tool schneidet Ihr Foto auf ${f.width_mm} × ${f.height_mm} mm mit korrekter Kopfposition zu, prüft es gegen die Größenvorgaben und liefert eine Datei in voller Auflösung ohne Wasserzeichen. Die Verarbeitung läuft komplett im Browser — das Foto wird nie hochgeladen.`,
      },
      {
        q: "Wie drucke ich es günstig aus?",
        a: `Laden Sie den Druckbogen herunter: ${copies} Fotos auf einem normalen 10 × 15 cm Abzug mit Schnittmarken. Bestellen Sie ihn als gewöhnlichen Fotoabzug in der Drogerie (meist unter 1 €) und schneiden Sie entlang der Marken. Beim Drucken „tatsächliche Größe“ wählen — nie „an Seite anpassen“.`,
      },
      ...(f.digital_spec
        ? [
            {
              q: "Gibt es eine Version für Online-Anträge?",
              a: `Ja — der Editor exportiert auch eine Datei mit ${f.digital_spec.width_px} × ${f.digital_spec.height_px} px (${f.digital_spec.format.toUpperCase()}, max. ${formatBytes(f.digital_spec.max_bytes)}), passend zu den Upload-Anforderungen.`,
            },
          ]
        : []),
    ],
  },
} as const;

export function FormatLanding({
  format,
  locale,
}: {
  format: PhotoFormat;
  locale: Locale;
}) {
  const t = STRINGS[locale];
  const label = formatLabel(format, locale);
  const sheet = layoutSheet(format, getPaper("10x15"));
  const faq = t.faq(label, format, sheet.copies);
  const backgroundText = t.backgrounds[format.background] ?? t.backgrounds.any!;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const rows: [string, string][] = [
    [t.photoSize, `${format.width_mm} × ${format.height_mm} mm`],
    ...(format.head_min_mm !== null && format.head_max_mm !== null
      ? ([[t.headHeight, `${format.head_min_mm}–${format.head_max_mm} mm`]] as [string, string][])
      : []),
    ...(format.eye_line_from_bottom_mm
      ? ([[t.eyeLine, `${format.eye_line_from_bottom_mm[0]}–${format.eye_line_from_bottom_mm[1]} mm`]] as [string, string][])
      : []),
    [t.background, backgroundText],
    [t.resolution, t.resolutionValue(format)],
    ...(format.digital_spec
      ? ([[t.digitalUpload, `${format.digital_spec.width_px} × ${format.digital_spec.height_px} px ${format.digital_spec.format.toUpperCase()}, max ${formatBytes(format.digital_spec.max_bytes)}`]] as [string, string][])
      : []),
    [t.perSheet, `${sheet.copies}`],
  ];

  const editorHref = `/?format=${format.id}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-8">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-sm font-semibold">
          <LogoMark className="h-7 w-7" />
          ID Photo Maker
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.h1(label, format)}
        </h1>
        <p className="mt-3 max-w-2xl text-balance leading-relaxed text-ink-muted">
          {t.intro(label)}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={editorHref} className="btn-primary min-w-44">
            {t.cta}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <IconLock className="h-3.5 w-3.5" />
            {t.onDevice}
          </span>
        </div>
      </header>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">
          {t.requirements}
        </h2>
        <dl>
          {rows.map(([term, value], index) => (
            <div
              key={term}
              className={`flex items-baseline justify-between gap-4 px-5 py-3 text-sm ${
                index > 0 ? "border-t border-line" : ""
              }`}
            >
              <dt className="text-ink-muted">{term}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {locale === "en" && format.notes && (
        <p className="mt-4 rounded-control border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {format.notes}
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t.faqTitle}</h2>
        <div className="space-y-3">
          {faq.map((item) => (
            <details key={item.q} className="card group px-5 py-4">
              <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-card border border-accent-border bg-accent-soft p-6 text-center">
        <h2 className="text-lg font-semibold tracking-tight">
          {t.finalTitle(label)}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-balance text-sm text-ink-muted">
          {t.finalSub}
        </p>
        <Link href={editorHref} className="btn-primary mx-auto mt-4 min-w-44">
          <IconCheck className="h-4 w-4" />
          {t.ctaBottom(format)}
        </Link>
      </section>

      <footer className="mt-12 border-t border-line pt-5 text-xs leading-relaxed text-ink-faint">
        <p>
          {t.verified(format)}{" "}
          {format.source_url.startsWith("https://") && (
            <a
              href={format.source_url}
              rel="nofollow noopener"
              className="underline decoration-line-strong underline-offset-2"
            >
              {t.source}
            </a>
          )}
        </p>
      </footer>
    </main>
  );
}
