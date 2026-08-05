import { describe, expect, it } from "vitest";
import {
  estimateHeadBounds,
  HAIR_ALLOWANCE_K,
  refineCrownFromMask,
} from "../src/detect/headBounds";
import { headBox, IMAGE_1000x1500, synthLandmarks } from "./fixtures";
import type { Size } from "../src/types";

const image = IMAGE_1000x1500;

describe("estimateHeadBounds", () => {
  const landmarks = synthLandmarks({
    image,
    chinY: 900,
    meshTopY: 300,
    eyeY: 500,
    midlineX: 480,
  });
  const head = estimateHeadBounds({ landmarks, image });

  it("reads the chin straight from landmark 152", () => {
    expect(head.yChin).toBeCloseTo(900, 6);
  });

  it("adds the hair allowance above the mesh top", () => {
    // 300 - 0.30 * (900 - 300)
    expect(head.yCrown).toBeCloseTo(300 - HAIR_ALLOWANCE_K * 600, 6);
    expect(head.crownSource).toBe("heuristic");
  });

  it("scales the allowance with face size", () => {
    const far = estimateHeadBounds({
      landmarks: synthLandmarks({ image, chinY: 600, meshTopY: 450, eyeY: 500, midlineX: 480 }),
      image,
    });
    const headHeight = far.yChin - far.yCrown;
    expect((450 - far.yCrown) / headHeight).toBeCloseTo(
      HAIR_ALLOWANCE_K / (1 + HAIR_ALLOWANCE_K),
      6,
    );
  });

  it("takes the eye line from the iris landmarks", () => {
    expect(head.yEyes).toBeCloseTo(500, 6);
  });

  it("uses the nose bridge as the midline", () => {
    expect(head.xMidline).toBeCloseTo(480, 6);
  });

  it("spans the widest landmarks horizontally", () => {
    expect(head.xLeft).toBeCloseTo(300, 6);
    expect(head.xRight).toBeCloseTo(660, 6);
  });

  it("rejects a landmark set that is not the face mesh", () => {
    expect(() => estimateHeadBounds({ landmarks: [], image })).toThrow(/face mesh/);
  });
});

describe("refineCrownFromMask", () => {
  const maskSize: Size = { width: 100, height: 150 };

  /** Foreground rectangle in mask coordinates. */
  function mask(top: number, left = 30, right = 70): Uint8Array {
    const data = new Uint8Array(maskSize.width * maskSize.height);
    for (let y = top; y < maskSize.height; y++) {
      for (let x = left; x <= right; x++) data[y * maskSize.width + x] = 255;
    }
    return data;
  }

  it("moves the crown to the topmost foreground pixel", () => {
    const head = headBox({ yCrown: 200, yChin: 800 });
    // mask row 15 of 150 == y 150 in a 1500px-tall image
    const refined = refineCrownFromMask(head, mask(15), maskSize, image);
    expect(refined.yCrown).toBeCloseTo(150, 6);
    expect(refined.crownSource).toBe("mask");
  });

  it("finds hair that is taller than the heuristic predicted", () => {
    const head = headBox({ yCrown: 200, yChin: 800 });
    const refined = refineCrownFromMask(head, mask(5), maskSize, image);
    expect(refined.yCrown).toBeLessThan(head.yCrown);
  });

  it("keeps the heuristic crown when the mask has no foreground", () => {
    const head = headBox();
    const empty = new Uint8Array(maskSize.width * maskSize.height);
    const refined = refineCrownFromMask(head, empty, maskSize, image);
    expect(refined).toEqual(head);
    expect(refined.crownSource).toBe("heuristic");
  });

  it("ignores foreground that only appears outside the face's horizontal span", () => {
    // Foreground far to the left of the face (e.g. a shoulder or an object).
    const head = headBox({ xLeft: 400, xRight: 600, yCrown: 200, yChin: 800 });
    const refined = refineCrownFromMask(head, mask(2, 0, 5), maskSize, image);
    expect(refined.crownSource).toBe("heuristic");
  });

  it("refuses a crown that would sit below the chin", () => {
    const head = headBox({ yCrown: 200, yChin: 300 });
    const refined = refineCrownFromMask(head, mask(120), maskSize, image);
    expect(refined.yCrown).toBe(200);
  });
});
