import { describe, expect, it } from "vitest";
import {
  dpiToPpm,
  effectiveDpi,
  exportPixelSize,
  mmToPx,
  ppmToDpi,
  pxToMm,
} from "../src/geometry/units";

describe("mm <-> px round trips", () => {
  const sizes = [20, 30, 33, 35, 40, 45, 48, 50, 51, 60, 70];

  for (const dpi of [300, 600, 1200]) {
    it(`is lossless to 0.01 mm at ${dpi} DPI`, () => {
      for (const mm of sizes) {
        expect(pxToMm(mmToPx(mm, dpi), dpi)).toBeCloseTo(mm, 6);
      }
    });
  }

  it("matches the classic reference values", () => {
    expect(mmToPx(25.4, 300)).toBeCloseTo(300, 10);
    expect(mmToPx(51, 600)).toBeCloseTo(1204.72, 2);
    expect(pxToMm(600, 600)).toBeCloseTo(25.4, 10);
  });
});

describe("exportPixelSize", () => {
  it("gives whole pixels at the target DPI", () => {
    expect(exportPixelSize(35, 45, 600)).toEqual({ width: 827, height: 1063 });
    expect(exportPixelSize(51, 51, 300)).toEqual({ width: 602, height: 602 });
  });

  it("keeps the aspect ratio within a pixel", () => {
    const { width, height } = exportPixelSize(35, 45, 600);
    expect(Math.abs(width / height - 35 / 45)).toBeLessThan(0.002);
  });
});

describe("dpi <-> pixels per metre", () => {
  it("round trips", () => {
    for (const dpi of [72, 300, 600, 1200]) {
      // dpiToPpm rounds to a whole pixels-per-metre, so the round trip is
      // accurate to ~0.01 DPI — far tighter than any print device resolves.
      expect(ppmToDpi(dpiToPpm(dpi))).toBeCloseTo(dpi, 1);
    }
  });

  it("uses the standard 300 DPI = 11811 ppm value", () => {
    expect(dpiToPpm(300)).toBe(11811);
  });
});

describe("effectiveDpi", () => {
  it("reports the print resolution of a crop", () => {
    expect(effectiveDpi(1063, 45)).toBeCloseTo(600, 0);
    expect(effectiveDpi(531, 45)).toBeCloseTo(300, 0);
  });

  it("returns zero for a degenerate physical size", () => {
    expect(effectiveDpi(1000, 0)).toBe(0);
  });
});
