import { FORMATS, type PhotoFormat } from "@photomaker/core";

/**
 * URL slugs for the per-format SEO pages (§8.3): /us-passport-photo,
 * /3x4-photo, … Derived from the registry id so adding a format automatically
 * adds a page (and its /de/ variant).
 */
export function formatSlug(format: PhotoFormat): string {
  const base = format.id.replace(/^generic-/, "");
  return base.endsWith("-photo") ? base : `${base}-photo`;
}

const bySlug = new Map(FORMATS.map((f) => [formatSlug(f), f]));

export function formatFromSlug(slug: string): PhotoFormat | undefined {
  return bySlug.get(slug);
}

export function allFormatSlugs(): string[] {
  return [...bySlug.keys()];
}
