import { describe, expect, it } from "vitest";
import { getPaper, PAPERS } from "../src/sheet/papers";
import {
  layoutSheet,
  SHEET_GAP_MM,
  SHEET_MARGIN_MM,
  type SheetLayout,
} from "../src/sheet/tiler";
import { getFormat, FORMATS } from "../src/formats/registry";
import { makeFormat } from "./fixtures";

/** No photo may overlap another or leave the sheet. */
function assertSane(layout: SheetLayout) {
  const { photoWidth_mm: w, photoHeight_mm: h } = layout;
  for (const a of layout.positions) {
    expect(a.x_mm).toBeGreaterThanOrEqual(0);
    expect(a.y_mm).toBeGreaterThanOrEqual(0);
    expect(a.x_mm + w).toBeLessThanOrEqual(layout.sheetWidth_mm + 1e-9);
    expect(a.y_mm + h).toBeLessThanOrEqual(layout.sheetHeight_mm + 1e-9);
    for (const b of layout.positions) {
      if (a === b) continue;
      const overlaps =
        a.x_mm < b.x_mm + w &&
        b.x_mm < a.x_mm + w &&
        a.y_mm < b.y_mm + h &&
        b.y_mm < a.y_mm + h;
      expect(overlaps).toBe(false);
    }
  }
}

describe("layoutSheet — the canonical drugstore case", () => {
  // 35×45 on 10×15 cm: 2 columns × 3 rows = 6 photos, the workflow the
  // product is built around (§1.4).
  const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));

  it("fits 6 photos as 2×3", () => {
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(3);
    expect(layout.copies).toBe(6);
    expect(layout.positions).toHaveLength(6);
  });

  it("stays portrait when landscape fits no more", () => {
    expect(layout.landscape).toBe(false);
    expect(layout.sheetWidth_mm).toBe(100);
    expect(layout.sheetHeight_mm).toBe(150);
  });

  it("centres the grid", () => {
    // grid: 2*35 + 2 = 72 wide, 3*45 + 2*2 = 139 tall
    const first = layout.positions[0]!;
    expect(first.x_mm).toBeCloseTo((100 - 72) / 2, 9);
    expect(first.y_mm).toBeCloseTo((150 - 139) / 2, 9);
  });

  it("uses the default 2 mm gap and 3 mm margin", () => {
    expect(layout.gap_mm).toBe(SHEET_GAP_MM);
    expect(layout.margin_mm).toBe(SHEET_MARGIN_MM);
    const [a, b] = [layout.positions[0]!, layout.positions[1]!];
    expect(b.x_mm - (a.x_mm + 35)).toBeCloseTo(2, 9);
  });

  it("produces a sane, non-overlapping layout", () => {
    assertSane(layout);
  });
});

describe("layoutSheet — orientation choice", () => {
  it("turns the sheet landscape when that fits more copies", () => {
    const portrait = layoutSheet(getFormat("cv-photo"), getPaper("13x18"));
    // portrait 13×18: cols fit(124,45)=2, rows fit(174,60)=2 → 4
    // landscape 18×13: cols fit(174,45)=3, rows fit(124,60)=2 → 6
    expect(portrait.landscape).toBe(true);
    expect(portrait.copies).toBe(6);
    assertSane(portrait);
  });

  it("keeps portrait on a tie", () => {
    const layout = layoutSheet(getFormat("us-passport"), getPaper("10x15"));
    expect(layout.copies).toBe(2);
    expect(layout.landscape).toBe(false);
  });
});

describe("layoutSheet — bounds and errors", () => {
  it("throws when the photo cannot fit at all", () => {
    const huge = makeFormat({ width_mm: 200, height_mm: 250 });
    expect(() => layoutSheet(huge, getPaper("10x15"))).toThrow(/does not fit/);
  });

  it("fits exactly one when the photo almost fills the paper", () => {
    const big = makeFormat({ width_mm: 90, height_mm: 140 });
    const layout = layoutSheet(big, getPaper("10x15"));
    expect(layout.copies).toBe(1);
    assertSane(layout);
  });

  it("honours custom gap and margin", () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"), {
      gap_mm: 0,
      margin_mm: 0,
    });
    // Without gaps/margins the landscape sheet wins: floor(150/35)=4 columns
    // × floor(100/45)=2 rows = 8 copies vs 6 portrait.
    expect(layout.copies).toBe(8);
    expect(layout.landscape).toBe(true);
    expect(layout.gap_mm).toBe(0);
    assertSane(layout);
  });

  it("lays out every format on every paper without overlap", () => {
    for (const format of FORMATS) {
      for (const paper of PAPERS) {
        assertSane(layoutSheet(format, paper));
      }
    }
  });

  it("A4 carries a full application's worth of biometric photos", () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("a4"));
    expect(layout.copies).toBeGreaterThanOrEqual(24);
    assertSane(layout);
  });
});

describe("layoutSheet — cut marks", () => {
  const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));

  it("never draws inside the photo grid", () => {
    const gridLeft = layout.positions[0]!.x_mm;
    const gridTop = layout.positions[0]!.y_mm;
    const gridRight = gridLeft + 2 * 35 + 2;
    const gridBottom = gridTop + 3 * 45 + 2 * 2;

    for (const mark of layout.cutMarks) {
      const inGridX =
        Math.min(mark.x1_mm, mark.x2_mm) > gridLeft - 1e-9 &&
        Math.max(mark.x1_mm, mark.x2_mm) < gridRight + 1e-9;
      const inGridY =
        Math.min(mark.y1_mm, mark.y2_mm) > gridTop - 1e-9 &&
        Math.max(mark.y1_mm, mark.y2_mm) < gridBottom + 1e-9;
      // A mark may align with a grid edge coordinate on one axis, but its
      // span on the other axis must lie outside the grid.
      expect(inGridX && inGridY).toBe(false);
    }
  });

  it("marks every photo edge on both sheet ends", () => {
    // 2 columns → 4 unique x edges, each with a top and bottom tick.
    const verticalMarks = layout.cutMarks.filter((m) => m.x1_mm === m.x2_mm);
    const uniqueX = new Set(verticalMarks.map((m) => m.x1_mm));
    expect(uniqueX.size).toBe(4);
    expect(verticalMarks).toHaveLength(8);

    // 3 rows → 6 unique horizontal edges, ticks left and right.
    const horizontalMarks = layout.cutMarks.filter((m) => m.y1_mm === m.y2_mm);
    const uniqueY = new Set(horizontalMarks.map((m) => m.y1_mm));
    expect(uniqueY.size).toBe(6);
    expect(horizontalMarks).toHaveLength(12);
  });

  it("keeps ticks clear of the sheet edge for borderless printing", () => {
    for (const mark of layout.cutMarks) {
      for (const v of [mark.x1_mm, mark.x2_mm]) {
        expect(v).toBeGreaterThanOrEqual(0.5 - 1e-9);
        expect(v).toBeLessThanOrEqual(layout.sheetWidth_mm - 0.5 + 1e-9);
      }
      for (const v of [mark.y1_mm, mark.y2_mm]) {
        expect(v).toBeGreaterThanOrEqual(0.5 - 1e-9);
        expect(v).toBeLessThanOrEqual(layout.sheetHeight_mm - 0.5 + 1e-9);
      }
    }
  });
});

describe("paper registry", () => {
  it("resolves known papers and rejects unknown ids", () => {
    expect(getPaper("10x15").width_mm).toBe(100);
    expect(() => getPaper("letter")).toThrow(/Unknown paper/);
  });
});
