import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLabel } from "@photomaker/core";
import { allFormatSlugs, formatFromSlug } from "../../lib/slugs";
import { FormatLanding } from "../../components/FormatLanding";

/** Statically generated English SEO landing page per format (§8.3). */

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
    alternates: {
      canonical: `/${slug}`,
      languages: { en: `/${slug}`, de: `/de/${slug}` },
    },
  };
}

export default async function FormatPage({ params }: PageProps) {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) notFound();
  return <FormatLanding format={format} locale="en" />;
}
