import { describe, expect, it } from "vitest";
import {
  classifyRange,
  solveCrop,
  targetHeadHeightMm,
  toSourceRect,
} from "../src/geometry/cropSolver";
import { getFormat } from "../src/formats/registry";
import {
  headBox,
  IMAGE_1000x1500,
  makeFormat,
  wellFramedHead,
} from "./fixtures";

const PX = 0.5; // crop rect assertions are accurate to half a pixel (§4.6)

describe("targetHeadHeightMm", () => {
  it("uses the midpoint of a regulated range", () => {
    expect(targetHeadHeightMm(makeFormat({ head_min_mm: 32, head_max_mm: 36 }))).toBe(34);
  });

  it("falls back to 75% of photo height when unregulated", () => {
    const format = makeFormat({
      head_min_mm: null,
      head_max_mm: null,
      height_mm: 60,
    });
    expect(targetHeadHeightMm(format)).toBeCloseTo(45, 6);
  });
});

describe("solveCrop — nominal framing", () => {
  const format = makeFormat(); // 35 x 45, head 32-36 -> target 34
  const head = headBox(); // 600 px head, crown y=200, midline x=500

  const solution = solveCrop({ head, format, image: IMAGE_1000x1500 });

  it("scales so the head hits the target height", () => {
    // 34 mm across 600 px
    expect(solution.mmPerPx).toBeCloseTo(34 / 600, 10);
    expect(solution.headHeightMm).toBeCloseTo(34, 10);
  });

  it("sizes the crop to the format's aspect and physical size", () => {
    expect(solution.rect.width).toBeCloseTo((35 * 600) / 34, 6);
    expect(solution.rect.height).toBeCloseTo((45 * 600) / 34, 6);
    expect(solution.rect.width / solution.rect.height).toBeCloseTo(35 / 45, 10);
  });

  it("places the crown at 42% of the leftover vertical space", () => {
    const crownMarginMm = (45 - 34) * 0.42;
    expect(solution.topMarginMm).toBeCloseTo(crownMarginMm, 6);
    expect(solution.rect.y).toBeCloseTo(200 - (crownMarginMm * 600) / 34, PX);
  });

  it("centres horizontally on the face midline, not the image centre", () => {
    expect(solution.rect.x + solution.rect.width / 2).toBeCloseTo(500, PX);
  });

  it("reports every check as passing", () => {
    expect(solution.level).toBe("ok");
    expect(solution.clamped).toBe(false);
    expect(solution.validations.every((v) => v.level === "ok")).toBe(true);
  });

  it("keeps the face midline centred when it is off to one side", () => {
    const offCentre = solveCrop({
      head: headBox({ xMidline: 400 }),
      format,
      image: IMAGE_1000x1500,
    });
    expect(offCentre.rect.x + offCentre.rect.width / 2).toBeCloseTo(400, PX);
    expect(offCentre.clamped).toBe(false);
  });
});

describe("solveCrop — head height boundaries", () => {
  const format = makeFormat(); // range 32-36, target 34, warn band ±1.7
  const head = headBox();
  const image = IMAGE_1000x1500;

  const atHeight = (mm: number) =>
    solveCrop({ head, format, image, adjust: { offsetX: 0, offsetY: 0, scale: mm / 34 } });

  it("passes exactly at the minimum", () => {
    const s = atHeight(32);
    expect(s.headHeightMm).toBeCloseTo(32, 8);
    expect(s.level).toBe("ok");
  });

  it("passes exactly at the maximum", () => {
    const s = atHeight(36);
    expect(s.headHeightMm).toBeCloseTo(36, 8);
    expect(s.level).toBe("ok");
  });

  it("warns just outside the range", () => {
    expect(atHeight(31).level).toBe("warn");
    expect(atHeight(37).level).toBe("warn");
  });

  it("errors beyond the tolerance band", () => {
    expect(atHeight(29).level).toBe("error");
    expect(atHeight(38).level).toBe("error");
  });

  it("treats an unregulated head height as informational only", () => {
    const s = solveCrop({
      head,
      format: makeFormat({ head_min_mm: null, head_max_mm: null }),
      image,
    });
    const check = s.validations.find((v) => v.id === "head-height");
    expect(check?.level).toBe("ok");
    expect(check?.range).toBeUndefined();
  });
});

describe("solveCrop — zoom and pan", () => {
  const format = makeFormat();
  const head = headBox();

  it("zooming in shrinks the crop and grows the head", () => {
    const base = solveCrop({ head, format, image: IMAGE_1000x1500 });
    const zoomed = solveCrop({
      head,
      format,
      image: IMAGE_1000x1500,
      adjust: { offsetX: 0, offsetY: 0, scale: 1.1 },
    });
    expect(zoomed.rect.height).toBeCloseTo(base.rect.height / 1.1, 6);
    expect(zoomed.headHeightMm).toBeCloseTo(34 * 1.1, 8);
  });

  it("panning moves the crop by exactly the offset", () => {
    const base = solveCrop({ head, format, image: IMAGE_1000x1500 });
    const panned = solveCrop({
      head,
      format,
      image: IMAGE_1000x1500,
      adjust: { offsetX: 25, offsetY: -40, scale: 1 },
    });
    expect(panned.rect.x - base.rect.x).toBeCloseTo(25, 8);
    expect(panned.rect.y - base.rect.y).toBeCloseTo(-40, 8);
  });

  it("rejects a non-positive scale", () => {
    expect(() =>
      solveCrop({
        head,
        format,
        image: IMAGE_1000x1500,
        adjust: { offsetX: 0, offsetY: 0, scale: 0 },
      }),
    ).toThrow(/scale/);
  });

  it("rejects inverted head bounds", () => {
    expect(() =>
      solveCrop({
        head: headBox({ yCrown: 800, yChin: 200 }),
        format,
        image: IMAGE_1000x1500,
      }),
    ).toThrow(/head bounds/);
  });
});

describe("solveCrop — clamping at image edges", () => {
  const format = makeFormat();

  it("clamps at the top edge when the head sits too high", () => {
    const s = solveCrop({
      head: headBox({ yCrown: 10, yChin: 610, yEyes: 240 }),
      format,
      image: IMAGE_1000x1500,
    });
    expect(s.rect.y).toBe(0);
    expect(s.clamped).toBe(true);
  });

  it("clamps at the bottom edge", () => {
    const s = solveCrop({
      head: headBox({ yCrown: 900, yChin: 1420, yEyes: 1100 }),
      format,
      image: IMAGE_1000x1500,
    });
    expect(s.rect.y + s.rect.height).toBeCloseTo(1500, PX);
    expect(s.clamped).toBe(true);
  });

  it("clamps at the left edge", () => {
    const s = solveCrop({
      head: headBox({ xMidline: 40 }),
      format,
      image: IMAGE_1000x1500,
    });
    expect(s.rect.x).toBe(0);
    expect(s.clamped).toBe(true);
  });

  it("clamps at the right edge", () => {
    const s = solveCrop({
      head: headBox({ xMidline: 960 }),
      format,
      image: IMAGE_1000x1500,
    });
    expect(s.rect.x + s.rect.width).toBeCloseTo(1000, PX);
    expect(s.clamped).toBe(true);
  });

  it("shrinks to fit and reports the head as out of spec when there is no room", () => {
    // A head filling nearly the whole frame: the ideal crop is far larger than
    // the image, so the achieved head height overshoots the maximum.
    const s = solveCrop({
      head: headBox({ yCrown: 20, yChin: 1480, yEyes: 600, xMidline: 500 }),
      format,
      image: { width: 1000, height: 1500 },
    });
    expect(s.clamped).toBe(true);
    expect(s.rect.width).toBeLessThanOrEqual(1000 + 1e-6);
    expect(s.rect.height).toBeLessThanOrEqual(1500 + 1e-6);
    expect(s.headHeightMm).toBeGreaterThan(36);
    expect(s.level).toBe("error");
    expect(s.validations.find((v) => v.id === "framing-room")?.message).toMatch(
      /enough room/i,
    );
  });

  it("keeps the reported millimetres consistent with the shrunk rect", () => {
    const s = solveCrop({
      head: headBox({ yCrown: 20, yChin: 1480, yEyes: 600 }),
      format,
      image: { width: 1000, height: 1500 },
    });
    // mm/px must always be derivable from the final rect, never from the ideal one.
    expect(s.mmPerPx).toBeCloseTo(format.height_mm / s.rect.height, 10);
    expect(s.headHeightMm).toBeCloseTo((1480 - 20) * s.mmPerPx, 8);
  });
});

describe("solveCrop — alternative vertical constraints", () => {
  it("honours an explicit top margin", () => {
    const format = makeFormat({ top_margin_mm: [4, 6] });
    const s = solveCrop({ head: headBox(), format, image: IMAGE_1000x1500 });
    expect(s.topMarginMm).toBeCloseTo(5, 8);
    expect(s.validations.find((v) => v.id === "top-margin")?.level).toBe("ok");
  });

  it("honours an eye line measured from the bottom", () => {
    const format = makeFormat({ eye_line_from_bottom_mm: [28, 32] });
    const s = solveCrop({ head: headBox(), format, image: IMAGE_1000x1500 });
    expect(s.eyeLineFromBottomMm).toBeCloseTo(30, 8);
    expect(s.validations.find((v) => v.id === "eye-line")?.level).toBe("ok");
  });

  it("prefers the top margin when a format specifies both", () => {
    const format = makeFormat({
      top_margin_mm: [3, 3],
      eye_line_from_bottom_mm: [28, 32],
    });
    const s = solveCrop({ head: headBox(), format, image: IMAGE_1000x1500 });
    expect(s.topMarginMm).toBeCloseTo(3, 8);
  });

  it("solves the real US passport spec within its eye-line window", () => {
    const s = solveCrop({
      head: wellFramedHead(),
      format: getFormat("us-passport"),
      image: IMAGE_1000x1500,
      sourceScale: 3,
    });
    expect(s.rect.width / s.rect.height).toBeCloseTo(1, 10);
    expect(s.eyeLineFromBottomMm).toBeGreaterThanOrEqual(28.6);
    expect(s.eyeLineFromBottomMm).toBeLessThanOrEqual(34.9);
    expect(s.level).toBe("ok");
  });
});

describe("solveCrop — print resolution gate", () => {
  const format = makeFormat();

  it("passes when the source has plenty of pixels", () => {
    const s = solveCrop({
      head: headBox(),
      format,
      image: IMAGE_1000x1500,
      sourceScale: 3,
    });
    expect(s.validations.find((v) => v.id === "resolution")?.level).toBe("ok");
  });

  it("warns below the format's minimum DPI", () => {
    // 45 mm at 300 DPI needs ~531 px; make the crop deliver ~250 DPI.
    const s = solveCrop({
      head: headBox({ yCrown: 300, yChin: 600, yEyes: 430 }),
      format,
      image: IMAGE_1000x1500,
      sourceScale: 1.1,
    });
    const check = s.validations.find((v) => v.id === "resolution");
    expect(check?.level).toBe("warn");
    expect(check?.value).toBeGreaterThan(200);
    expect(check?.value).toBeLessThan(300);
  });

  it("errors below the hard 200 DPI floor", () => {
    const s = solveCrop({
      head: headBox({ yCrown: 300, yChin: 600, yEyes: 430 }),
      format,
      image: IMAGE_1000x1500,
      sourceScale: 0.5,
    });
    expect(s.validations.find((v) => v.id === "resolution")?.level).toBe("error");
    expect(s.level).toBe("error");
  });
});

describe("classifyRange", () => {
  it("is inclusive at both ends", () => {
    expect(classifyRange(32, [32, 36])).toBe("ok");
    expect(classifyRange(36, [32, 36])).toBe("ok");
  });

  it("uses a ±5% band of the range midpoint for the amber state", () => {
    expect(classifyRange(36 + 1.7, [32, 36])).toBe("warn");
    expect(classifyRange(36 + 1.71, [32, 36])).toBe("error");
  });
});

describe("toSourceRect", () => {
  it("scales a working-copy rect back onto the original image", () => {
    const rect = { x: 10, y: 20, width: 100, height: 200 };
    expect(toSourceRect(rect, 2.5)).toEqual({
      x: 25,
      y: 50,
      width: 250,
      height: 500,
    });
  });
});

describe("every registered format solves cleanly on a well-framed portrait", () => {
  const head = wellFramedHead();
  const image = IMAGE_1000x1500;

  for (const id of [
    "generic-3x4",
    "generic-2x3",
    "generic-4x6cm",
    "eu-biometric-35x45",
    "uk-passport",
    "us-passport",
    "cn-visa",
    "in-passport",
    "ca-passport",
    "de-fuehrerschein",
    "cv-photo",
  ]) {
    it(id, () => {
      const format = getFormat(id);
      const s = solveCrop({ head, format, image, sourceScale: 3 });
      expect(s.level).toBe("ok");
      expect(s.rect.width / s.rect.height).toBeCloseTo(
        format.width_mm / format.height_mm,
        8,
      );
      if (format.head_min_mm !== null && format.head_max_mm !== null) {
        expect(s.headHeightMm).toBeGreaterThanOrEqual(format.head_min_mm);
        expect(s.headHeightMm).toBeLessThanOrEqual(format.head_max_mm);
      }
    });
  }
});
