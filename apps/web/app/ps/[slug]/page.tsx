import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLabel } from "@photomaker/core";
import { allFormatSlugs, formatFromSlug } from "../../../lib/slugs";
import { FormatLanding } from "../../../components/FormatLanding";

/** Statically generated Pashto SEO landing page per format (§8.3, §5.8). */

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
  const label = formatLabel(format, "ps");
  return {
    title: `د ${label} عکس — وړیا جوړول (${format.width_mm}×${format.height_mm} ملي متره)`,
    description: `د ${label} عکس (${format.width_mm} × ${format.height_mm} ملي متره) وړیا آنلاین جوړ کړئ. رسمي اندازې ته اتوماتیک برش، د سر سم لوړوالی، د چاپ لپاره چمتو په ${format.target_dpi} DPI. ستاسو عکس هېڅکله له وسیلې نه بهر نه ځي.`,
    alternates: {
      canonical: `/ps/${slug}`,
      languages: {
        en: `/${slug}`,
        de: `/de/${slug}`,
        "fa-AF": `/fa/${slug}`,
        ps: `/ps/${slug}`,
      },
    },
  };
}

export default async function FormatPagePs({ params }: PageProps) {
  const { slug } = await params;
  const format = formatFromSlug(slug);
  if (!format) notFound();
  return <FormatLanding format={format} locale="ps" />;
}
