import { describe, expect, it } from "vitest";
import registryJson from "../src/formats/formats.json";
import { formatRegistrySchema, photoFormatSchema } from "../src/formats/schema";
import {
  DEFAULT_FORMAT_ID,
  FORMATS,
  findFormat,
  formatsForCountry,
  getFormat,
  searchFormats,
} from "../src/formats/registry";

describe("format registry", () => {
  it("validates against the schema", () => {
    expect(() => formatRegistrySchema.parse(registryJson)).not.toThrow();
  });

  it("ships at least the launch set", () => {
    expect(FORMATS.length).toBeGreaterThanOrEqual(10);
  });

  it("has unique ids", () => {
    const ids = FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every format a source and a verification date", () => {
    for (const format of FORMATS) {
      expect(format.source_url.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(format.verified_date))).toBe(false);
    }
  });

  it("requires an https source for every official format", () => {
    for (const format of FORMATS) {
      if (format.category === "generic" || format.category === "other") continue;
      expect(format.source_url).toMatch(/^https:\/\//);
    }
  });

  it("keeps head-height ranges inside the photo", () => {
    for (const format of FORMATS) {
      if (format.head_max_mm === null) continue;
      expect(format.head_max_mm).toBeLessThan(format.height_mm);
      expect(format.head_min_mm ?? 0).toBeLessThanOrEqual(format.head_max_mm);
    }
  });

  it("resolves the default format", () => {
    expect(findFormat(DEFAULT_FORMAT_ID)).toBeDefined();
  });

  it("throws a helpful error for an unknown id", () => {
    expect(() => getFormat("nope")).toThrow(/Unknown format/);
  });
});

describe("format lookup", () => {
  it("finds formats by country", () => {
    expect(formatsForCountry("US").map((f) => f.id)).toContain("us-passport");
    expect(formatsForCountry("de").map((f) => f.id)).toContain("de-fuehrerschein");
  });

  it("searches by label, dimensions and id", () => {
    expect(searchFormats("35x45").map((f) => f.id)).toContain("eu-biometric-35x45");
    expect(searchFormats("passport").map((f) => f.id)).toContain("us-passport");
    expect(searchFormats("Führerschein").map((f) => f.id)).toContain(
      "de-fuehrerschein",
    );
  });

  it("returns everything for an empty query", () => {
    expect(searchFormats("  ")).toHaveLength(FORMATS.length);
  });
});

describe("schema rejects unusable entries", () => {
  const base = {
    id: "test-x",
    label: { en: "Test" },
    category: "generic",
    countries: [],
    width_mm: 35,
    height_mm: 45,
    head_min_mm: 32,
    head_max_mm: 36,
    min_dpi: 300,
    target_dpi: 600,
    background: "white",
    source_url: "internal:generic-format",
    verified_date: "2026-01-01",
    verification_status: "seeded",
  };

  it("accepts the base entry", () => {
    expect(() => photoFormatSchema.parse(base)).not.toThrow();
  });

  it("rejects an inverted head range", () => {
    expect(() =>
      photoFormatSchema.parse({ ...base, head_min_mm: 36, head_max_mm: 32 }),
    ).toThrow();
  });

  it("rejects a head taller than the photo", () => {
    expect(() => photoFormatSchema.parse({ ...base, head_max_mm: 50 })).toThrow();
  });

  it("rejects a non-kebab-case id", () => {
    expect(() => photoFormatSchema.parse({ ...base, id: "US Passport" })).toThrow();
  });

  it("rejects a missing English label", () => {
    expect(() => photoFormatSchema.parse({ ...base, label: { de: "Test" } })).toThrow();
  });

  it("rejects an http source url", () => {
    expect(() =>
      photoFormatSchema.parse({ ...base, source_url: "http://example.com" }),
    ).toThrow();
  });

  it("rejects a target DPI below the minimum", () => {
    expect(() => photoFormatSchema.parse({ ...base, target_dpi: 150 })).toThrow();
  });

  it("rejects an eye line taller than the photo", () => {
    expect(() =>
      photoFormatSchema.parse({ ...base, eye_line_from_bottom_mm: [40, 50] }),
    ).toThrow();
  });
});
