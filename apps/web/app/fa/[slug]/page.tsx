import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLabel } from "@photomaker/core";
import { allFormatSlugs, formatFromSlug } from "../../../lib/slugs";
import { FormatLanding } from "../../../components/FormatLanding";

/** Statically generated Dari (fa-AF) SEO landing page per format (§8.3, §5.8). */

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
  const label = formatLabel(format, "fa");
  return {
    title: `عکس ${label} — ساخت رایگان (${format.width_mm}×${format.height_mm} میلی‌متر)`,
    description: `عکس ${label} (${format.width_mm} × ${format.height_mm} میلی‌متر) را رایگان و آنلاین بسازید. برش خودکار به اندازهٔ رسمی، ارتفاع درست سر، آمادهٔ چاپ با ${format.target_dpi} DPI. عکس شما هرگز از دستگاه‌تان خارج نمی‌شود.`,
    alternates: {
      canonical: `/fa/${slug}`,
      languages: {
        en: `/${slug}`,
        de: `/de/${slug}`,
        "fa-AF": `/fa/${slug}`,
        ps: `/ps/${slug}`,
      },
    },
  };
}

export default async function FormatPageFa({ params }: PageProps) {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) notFound();
  return <FormatLanding format={format} locale="fa" />;
}
