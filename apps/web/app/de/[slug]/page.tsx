import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLabel } from "@photomaker/core";
import { allFormatSlugs, formatFromSlug } from "../../../lib/slugs";
import { FormatLanding } from "../../../components/FormatLanding";

/** Statically generated German SEO landing page per format (§8.3, §5.8). */

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
  const label = formatLabel(format, "de");
  return {
    title: `${label} — kostenlos erstellen (${format.width_mm}×${format.height_mm} mm)`,
    description: `${label} (${format.width_mm} × ${format.height_mm} mm) kostenlos online erstellen. Automatischer Zuschnitt auf das amtliche Maß, korrekte Kopfhöhe, druckfertig mit ${format.target_dpi} DPI. Ihr Foto verlässt nie Ihr Gerät.`,
    alternates: {
      canonical: `/de/${slug}`,
      languages: { en: `/${slug}`, de: `/de/${slug}` },
    },
  };
}

export default async function FormatPageDe({ params }: PageProps) {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) notFound();
  return <FormatLanding format={format} locale="de" />;
}
