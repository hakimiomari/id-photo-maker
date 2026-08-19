import { describe, expect, it } from "vitest";
import {
  bilinearResizeAlpha,
  foregroundRatio,
  inferenceSize,
  matteToAlpha,
  toModNetInput,
} from "../src/segment/matting";

describe("inferenceSize", () => {
  it("scales the long edge to the reference and rounds to /32", () => {
    const size = inferenceSize({ width: 1536, height: 2048 });
    expect(size.height).toBe(512);
    expect(size.width % 32).toBe(0);
    expect(size.width).toBe(384); // 1536 * (512/2048) = 384
  });

  it("handles landscape input", () => {
    const size = inferenceSize({ width: 2048, height: 1024 });
    expect(size.width).toBe(512);
    expect(size.height).toBe(256);
  });

  it("never returns a dimension below 32", () => {
    const size = inferenceSize({ width: 5000, height: 100 });
    expect(size.height).toBeGreaterThanOrEqual(32);
    expect(size.width % 32).toBe(0);
  });

  it("keeps both sides divisible by 32 for every plausible aspect", () => {
    for (const [w, h] of [[820, 1024], [3000, 4000], [1, 1], [999, 333]] as const) {
      const s = inferenceSize({ width: w, height: h });
      expect(s.width % 32).toBe(0);
      expect(s.height % 32).toBe(0);
    }
  });
});

describe("toModNetInput", () => {
  it("normalizes RGBA to (x-127.5)/127.5 in NCHW planes", () => {
    // 2×1 image: black pixel, white pixel.
    const rgba = Uint8Array.from([0, 0, 0, 255, 255, 255, 255, 255]);
    const out = toModNetInput(rgba, { width: 2, height: 1 });
    expect(out).toHaveLength(6);
    // R plane
    expect(out[0]).toBeCloseTo(-1, 6);
    expect(out[1]).toBeCloseTo(1, 6);
    // G plane
    expect(out[2]).toBeCloseTo(-1, 6);
    expect(out[3]).toBeCloseTo(1, 6);
    // B plane
    expect(out[4]).toBeCloseTo(-1, 6);
    expect(out[5]).toBeCloseTo(1, 6);
  });

  it("drops the alpha channel", () => {
    const rgba = Uint8Array.from([127.5, 127.5, 127.5, 0].map(Math.round));
    const out = toModNetInput(rgba, { width: 1, height: 1 });
    for (const v of out) expect(Math.abs(v)).toBeLessThan(0.01);
  });
});

describe("matteToAlpha", () => {
  it("maps [0,1] to [0,255] with clamping", () => {
    const alpha = matteToAlpha(Float32Array.from([0, 0.5, 1, -0.2, 1.7]));
    expect([...alpha]).toEqual([0, 128, 255, 0, 255]);
  });
});

describe("bilinearResizeAlpha", () => {
  it("is the identity at equal sizes (and copies)", () => {
    const src = Uint8Array.from([1, 2, 3, 4]);
    const out = bilinearResizeAlpha(src, { width: 2, height: 2 }, { width: 2, height: 2 });
    expect([...out]).toEqual([1, 2, 3, 4]);
    out[0] = 99;
    expect(src[0]).toBe(1); // no aliasing
  });

  it("preserves corner values exactly", () => {
    const src = Uint8Array.from([10, 20, 30, 40]);
    const out = bilinearResizeAlpha(src, { width: 2, height: 2 }, { width: 5, height: 5 });
    expect(out[0]).toBe(10);
    expect(out[4]).toBe(20);
    expect(out[20]).toBe(30);
    expect(out[24]).toBe(40);
  });

  it("interpolates linearly between corners", () => {
    const src = Uint8Array.from([0, 100]);
    const out = bilinearResizeAlpha(src, { width: 2, height: 1 }, { width: 5, height: 1 });
    expect([...out]).toEqual([0, 25, 50, 75, 100]);
  });

  it("upsamples a hard edge into a smooth ramp (the matte use-case)", () => {
    // 4×1: hard 0|255 edge.
    const src = Uint8Array.from([0, 0, 255, 255]);
    const out = bilinearResizeAlpha(src, { width: 4, height: 1 }, { width: 16, height: 1 });
    // Monotonically non-decreasing, hits both extremes.
    expect(out[0]).toBe(0);
    expect(out[15]).toBe(255);
    for (let i = 1; i < 16; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(out[i - 1] as number);
    }
  });
});

describe("foregroundRatio", () => {
  it("counts pixels at or above the threshold", () => {
    const alpha = Uint8Array.from([0, 127, 128, 255]);
    expect(foregroundRatio(alpha)).toBe(0.5);
  });

  it("is 0 for an empty mask", () => {
    expect(foregroundRatio(new Uint8Array(0))).toBe(0);
  });
});
