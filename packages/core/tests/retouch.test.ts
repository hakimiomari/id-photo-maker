import { describe, expect, it } from "vitest";
import { healSpot } from "../src/retouch/heal";
import { applySmoothing } from "../src/retouch/smooth";
import { paintStrokeMask, scaleOp, type SmoothOp } from "../src/retouch/ops";
import type { Size } from "../src/types";

const SIZE: Size = { width: 64, height: 64 };

/** Uniform grey field with a dark square "blemish" in the middle. */
function blemishedImage(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE.width * SIZE.height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 180;
    data[i + 1] = 150;
    data[i + 2] = 130;
    data[i + 3] = 255;
  }
  for (let y = 30; y < 34; y++) {
    for (let x = 30; x < 34; x++) {
      const o = (y * SIZE.width + x) * 4;
      data[o] = 60;
      data[o + 1] = 40;
      data[o + 2] = 40;
    }
  }
  return data;
}

describe("healSpot", () => {
  it("removes the blemish, matching the surrounding skin", () => {
    const data = blemishedImage();
    healSpot(data, SIZE, { kind: "heal", x: 32, y: 32, radius: 6 });
    const centre = (32 * SIZE.width + 32) * 4;
    expect(Math.abs((data[centre] as number) - 180)).toBeLessThan(6);
    expect(Math.abs((data[centre + 1] as number) - 150)).toBeLessThan(6);
  });

  it("leaves pixels outside the radius untouched", () => {
    const data = blemishedImage();
    const before = data.slice();
    healSpot(data, SIZE, { kind: "heal", x: 32, y: 32, radius: 6 });
    const far = (10 * SIZE.width + 10) * 4;
    expect(data[far]).toBe(before[far]);
  });

  it("is deterministic", () => {
    const a = blemishedImage();
    const b = blemishedImage();
    healSpot(a, SIZE, { kind: "heal", x: 32, y: 32, radius: 6 });
    healSpot(b, SIZE, { kind: "heal", x: 32, y: 32, radius: 6 });
    expect([...a]).toEqual([...b]);
  });

  it("does nothing for a spot entirely off the edge", () => {
    const data = blemishedImage();
    const before = data.slice();
    healSpot(data, SIZE, { kind: "heal", x: -20, y: -20, radius: 4 });
    expect([...data]).toEqual([...before]);
  });
});

describe("applySmoothing", () => {
  /** Noisy region: alternating light/dark checkerboard. */
  function noisyImage(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(SIZE.width * SIZE.height * 4);
    for (let y = 0; y < SIZE.height; y++) {
      for (let x = 0; x < SIZE.width; x++) {
        const v = (x + y) % 2 === 0 ? 100 : 200;
        const o = (y * SIZE.width + x) * 4;
        data[o] = v;
        data[o + 1] = v;
        data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return data;
  }

  function localVariance(data: Uint8ClampedArray, x0: number, y0: number, n: number): number {
    let sum = 0;
    let sq = 0;
    for (let y = y0; y < y0 + n; y++) {
      for (let x = x0; x < x0 + n; x++) {
        const v = data[(y * SIZE.width + x) * 4] as number;
        sum += v;
        sq += v * v;
      }
    }
    const mean = sum / (n * n);
    return sq / (n * n) - mean * mean;
  }

  it("reduces variance inside the mask, leaves outside untouched", () => {
    const data = noisyImage();
    const before = data.slice();
    const mask = new Uint8Array(SIZE.width * SIZE.height);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) mask[y * SIZE.width + x] = 255;

    applySmoothing(data, SIZE, mask, 2, 0.8);

    expect(localVariance(data, 24, 24, 10)).toBeLessThan(localVariance(before, 24, 24, 10) / 2);
    const far = (5 * SIZE.width + 5) * 4;
    expect(data[far]).toBe(before[far]);
  });

  it("strength 0 is the identity", () => {
    const data = noisyImage();
    const before = data.slice();
    const mask = new Uint8Array(SIZE.width * SIZE.height).fill(255);
    applySmoothing(data, SIZE, mask, 2, 0);
    expect([...data]).toEqual([...before]);
  });

  it("does nothing for an empty mask", () => {
    const data = noisyImage();
    const before = data.slice();
    applySmoothing(data, SIZE, new Uint8Array(SIZE.width * SIZE.height), 2, 1);
    expect([...data]).toEqual([...before]);
  });
});

describe("paintStrokeMask", () => {
  it("covers the stroke path without gaps on fast strokes", () => {
    const mask = new Uint8Array(SIZE.width * SIZE.height);
    const op: SmoothOp = {
      kind: "smooth",
      points: Float32Array.from([5, 32, 58, 32]), // one long segment
      radius: 4,
      strength: 1,
    };
    paintStrokeMask(mask, SIZE, op);
    // Every x along the path centre is painted.
    for (let x = 6; x < 58; x++) {
      expect(mask[32 * SIZE.width + x]).toBeGreaterThan(200);
    }
    // Far from the path: untouched.
    expect(mask[5 * SIZE.width + 5]).toBe(0);
  });

  it("feathers the brush edge", () => {
    const mask = new Uint8Array(SIZE.width * SIZE.height);
    paintStrokeMask(mask, SIZE, {
      kind: "smooth",
      points: Float32Array.from([32, 32]),
      radius: 10,
      strength: 1,
    });
    const centre = mask[32 * SIZE.width + 32] as number;
    const rim = mask[32 * SIZE.width + 41] as number; // near the edge
    expect(centre).toBe(255);
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThan(128);
  });
});

describe("scaleOp", () => {
  it("scales heal geometry", () => {
    expect(scaleOp({ kind: "heal", x: 10, y: 20, radius: 5 }, 3)).toEqual({
      kind: "heal",
      x: 30,
      y: 60,
      radius: 15,
    });
  });

  it("scales stroke points and radius but not strength", () => {
    const op = scaleOp(
      { kind: "smooth", points: Float32Array.from([1, 2]), radius: 4, strength: 0.5 },
      2,
    );
    expect(op.kind).toBe("smooth");
    if (op.kind === "smooth") {
      expect([...op.points]).toEqual([2, 4]);
      expect(op.radius).toBe(8);
      expect(op.strength).toBe(0.5);
    }
  });
});
