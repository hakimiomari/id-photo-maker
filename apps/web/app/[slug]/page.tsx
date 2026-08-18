import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatLabel,
  layoutSheet,
  getPaper,
  type PhotoFormat,
} from "@photomaker/core";
import { allFormatSlugs, formatFromSlug } from "../../lib/slugs";
import { formatBytes } from "../../lib/bytes";
import { IconCheck, IconLock, LogoMark } from "../../components/icons";

/**
 * Statically generated SEO landing page per format (§8.3): the exact spec
 * table, an FAQ with schema.org markup, and a CTA that opens the editor with
 * the format preselected. Every number on this page comes from the registry.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return allFormatSlugs().map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) return {};
  const label = formatLabel(format);
  return {
    title: `${label} — free ${format.width_mm}×${format.height_mm} mm photo maker`,
    description: `Make a ${label} photo (${format.width_mm} × ${format.height_mm} mm) online for free. Auto-crop to the official size, correct head height, print-ready at ${format.target_dpi} DPI. Your photo never leaves your device.`,
    alternates: { canonical: `/${slug}` },
  };
}

function backgroundText(format: PhotoFormat): string {
  switch (format.background) {
    case "white":
      return "Plain white";
    case "light_grey":
      return "Light grey (plain, even)";
    case "off_white":
      return "Off-white";
    case "blue":
      return "Blue";
    case "red":
      return "Red";
    default:
      return "No official requirement — plain and even is safest";
  }
}

function buildFaq(format: PhotoFormat): { q: string; a: string }[] {
  const label = formatLabel(format);
  const sheet = layoutSheet(format, getPaper("10x15"));
  const faq = [
    {
      q: `What size is a ${label} photo?`,
      a: `${format.width_mm} × ${format.height_mm} mm.${
        format.head_min_mm !== null && format.head_max_mm !== null
          ? ` The head, measured from chin to crown, must be ${format.head_min_mm}–${format.head_max_mm} mm tall.`
          : ""
      }`,
    },
    {
      q: "Can I make this photo online for free?",
      a: `Yes. This tool crops your photo to ${format.width_mm} × ${format.height_mm} mm with the correct head position, checks it against the size requirements, and gives you a full-resolution file with no watermark. All processing happens in your browser — the photo is never uploaded.`,
    },
    {
      q: "How do I print it cheaply?",
      a: `Download the print sheet: ${sheet.copies} photos arranged on a standard 10 × 15 cm print with cut marks. Order it as a normal photo print at any drugstore (usually under 1 €), then cut along the marks. Choose “actual size” when printing — never “fit to page”.`,
    },
    {
      q: "What background does it need?",
      a: backgroundText(format) + ".",
    },
  ];
  if (format.digital_spec) {
    faq.push({
      q: "Is there a version for online applications?",
      a: `Yes — the editor can also export a ${format.digital_spec.width_px} × ${format.digital_spec.height_px} px ${format.digital_spec.format.toUpperCase()} capped at ${formatBytes(format.digital_spec.max_bytes)}, matching the digital upload requirements.`,
    });
  }
  return faq;
}

export default async function FormatPage({ params }: PageProps) {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) notFound();

  const label = formatLabel(format);
  const faq = buildFaq(format);
  const sheet = layoutSheet(format, getPaper("10x15"));

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
    ["Photo size", `${format.width_mm} × ${format.height_mm} mm`],
    ...(format.head_min_mm !== null && format.head_max_mm !== null
      ? ([["Head height (chin to crown)", `${format.head_min_mm}–${format.head_max_mm} mm`]] as [string, string][])
      : []),
    ...(format.eye_line_from_bottom_mm
      ? ([["Eye line from bottom edge", `${format.eye_line_from_bottom_mm[0]}–${format.eye_line_from_bottom_mm[1]} mm`]] as [string, string][])
      : []),
    ["Background", backgroundText(format)],
    ["Print resolution", `${format.target_dpi} DPI (minimum ${format.min_dpi})`],
    ...(format.digital_spec
      ? ([["Digital upload", `${format.digital_spec.width_px} × ${format.digital_spec.height_px} px ${format.digital_spec.format.toUpperCase()}, max ${formatBytes(format.digital_spec.max_bytes)}`]] as [string, string][])
      : []),
    ["Photos per 10 × 15 cm print", `${sheet.copies}`],
  ];

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
          {label} photo — {format.width_mm} × {format.height_mm} mm, free and
          in your browser
        </h1>
        <p className="mt-3 max-w-2xl text-balance leading-relaxed text-ink-muted">
          Upload a portrait and get a correctly sized, print-ready {label}{" "}
          photo: automatic face detection, the official head-height ratio, and
          a full-resolution download with no watermark. Your photo never leaves
          your device.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`/?format=${format.id}`} className="btn-primary min-w-44">
            Open in the editor
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <IconLock className="h-3.5 w-3.5" />
            100% on-device — no uploads
          </span>
        </div>
      </header>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">
          Official requirements
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

      {format.notes && (
        <p className="mt-4 rounded-control border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {format.notes}
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Frequently asked questions
        </h2>
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
          Make your {label} photo now
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-balance text-sm text-ink-muted">
          Free, full resolution, no watermark, no sign-up. Works on your phone.
        </p>
        <Link
          href={`/?format=${format.id}`}
          className="btn-primary mx-auto mt-4 min-w-44"
        >
          <IconCheck className="h-4 w-4" />
          Start with {format.width_mm} × {format.height_mm} mm
        </Link>
      </section>

      <footer className="mt-12 border-t border-line pt-5 text-xs leading-relaxed text-ink-faint">
        <p>
          Spec last checked {format.verified_date}
          {format.verification_status === "seeded" && " (not yet re-verified)"}.
          Not affiliated with any government — always confirm the requirements
          with the issuing authority.{" "}
          {format.source_url.startsWith("https://") && (
            <a
              href={format.source_url}
              rel="nofollow noopener"
              className="underline decoration-line-strong underline-offset-2"
            >
              Official source
            </a>
          )}
        </p>
      </footer>
    </main>
  );
}
