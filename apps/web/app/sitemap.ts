import type { MetadataRoute } from "next";
import { allFormatSlugs } from "../lib/slugs";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = allFormatSlugs();
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    ...slugs.map((slug) => ({
      url: `${BASE}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...slugs.map((slug) => ({
      url: `${BASE}/de/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...slugs.flatMap((slug) => [
      {
        url: `${BASE}/fa/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      },
      {
        url: `${BASE}/ps/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      },
    ]),
  ];
}
