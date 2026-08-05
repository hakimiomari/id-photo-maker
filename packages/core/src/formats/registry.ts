import registryJson from "./formats.json";
import { formatRegistrySchema } from "./schema";
import type { FormatCategory, PhotoFormat } from "../types";

/**
 * The registry is parsed once at module load. If formats.json is malformed the
 * app fails loudly here rather than silently producing wrong-sized photos.
 */
const parsed = formatRegistrySchema.parse(registryJson);

export const FORMATS: readonly PhotoFormat[] = parsed.formats as PhotoFormat[];

const byId = new Map(FORMATS.map((f) => [f.id, f]));

export function getFormat(id: string): PhotoFormat {
  const format = byId.get(id);
  if (!format) throw new Error(`Unknown format id: ${id}`);
  return format;
}

export function findFormat(id: string): PhotoFormat | undefined {
  return byId.get(id);
}

export const DEFAULT_FORMAT_ID = "generic-3x4";

export function formatsByCategory(): Record<FormatCategory, PhotoFormat[]> {
  const groups: Record<FormatCategory, PhotoFormat[]> = {
    passport: [],
    visa: [],
    license: [],
    generic: [],
    other: [],
  };
  for (const f of FORMATS) groups[f.category].push(f);
  return groups;
}

/** Formats matching a country code, most specific first. */
export function formatsForCountry(country: string): PhotoFormat[] {
  const cc = country.toUpperCase();
  return FORMATS.filter((f) => f.countries.includes(cc));
}

export function formatLabel(format: PhotoFormat, locale = "en"): string {
  return format.label[locale] ?? format.label.en ?? format.id;
}

/** e.g. "35 × 45 mm" */
export function formatDimensions(format: PhotoFormat): string {
  return `${format.width_mm} × ${format.height_mm} mm`;
}

export function searchFormats(query: string, locale = "en"): PhotoFormat[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...FORMATS];
  return FORMATS.filter((f) => {
    const haystack = [
      f.id,
      formatLabel(f, locale),
      ...Object.values(f.label),
      ...f.countries,
      formatDimensions(f),
      `${f.width_mm}x${f.height_mm}`,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
