import { describe, expect, it } from "vitest";
import {
  orientationSwapsAxes,
  orientationTransform,
  parseExifOrientation,
  type ExifOrientation,
} from "../src/ingest/exif";

/** Build a JPEG head containing an EXIF APP1 with the given orientation. */
function jpegWithOrientation(
  orientation: number,
  little = false,
): ArrayBuffer {
  const tiff: number[] = [];
  const push16 = (v: number) =>
    little ? tiff.push(v & 0xff, (v >> 8) & 0xff) : tiff.push((v >> 8) & 0xff, v & 0xff);
  const push32 = (v: number) =>
    little
      ? tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff)
      : tiff.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d])); // byte order
  push16(42);
  push32(8); // IFD0 offset
  push16(1); // one entry
  push16(0x0112); // Orientation
  push16(3); // SHORT
  push32(1); // count
  push16(orientation);
  push16(0); // padding of the 4-byte value field
  push32(0); // next IFD

  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = exif.length + 2;

  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff,
    ...exif,
    0xff, 0xd9,
  ]).buffer;
}

describe("parseExifOrientation", () => {
  it("reads big-endian (Motorola) EXIF", () => {
    for (let o = 1; o <= 8; o++) {
      expect(parseExifOrientation(jpegWithOrientation(o))).toBe(o);
    }
  });

  it("reads little-endian (Intel) EXIF", () => {
    expect(parseExifOrientation(jpegWithOrientation(6, true))).toBe(6);
    expect(parseExifOrientation(jpegWithOrientation(8, true))).toBe(8);
  });

  it("defaults to 1 for a JPEG without EXIF", () => {
    const plain = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]).buffer;
    expect(parseExifOrientation(plain)).toBe(1);
  });

  it("defaults to 1 for non-JPEG data", () => {
    expect(parseExifOrientation(Uint8Array.from([1, 2, 3, 4]).buffer)).toBe(1);
  });

  it("defaults to 1 for a nonsensical orientation value", () => {
    expect(parseExifOrientation(jpegWithOrientation(99))).toBe(1);
  });
});

describe("orientationSwapsAxes", () => {
  it("is true exactly for the rotated-90 cases", () => {
    const swapping = [5, 6, 7, 8];
    for (let o = 1 as number; o <= 8; o++) {
      expect(orientationSwapsAxes(o as ExifOrientation)).toBe(swapping.includes(o));
    }
  });
});

describe("orientationTransform", () => {
  /** Apply the 2D affine matrix to a point. */
  const apply = (
    m: [number, number, number, number, number, number],
    x: number,
    y: number,
  ): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  const W = 4;
  const H = 2;

  it("is the identity for orientation 1", () => {
    expect(orientationTransform(1, W, H)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("maps every corner of the source inside the destination", () => {
    for (let o = 1; o <= 8; o++) {
      const orientation = o as ExifOrientation;
      const m = orientationTransform(orientation, W, H);
      const swap = orientationSwapsAxes(orientation);
      const destW = swap ? H : W;
      const destH = swap ? W : H;
      for (const [x, y] of [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ] as const) {
        const [dx, dy] = apply(m, x, y);
        expect(dx).toBeGreaterThanOrEqual(-1e-9);
        expect(dy).toBeGreaterThanOrEqual(-1e-9);
        expect(dx).toBeLessThanOrEqual(destW + 1e-9);
        expect(dy).toBeLessThanOrEqual(destH + 1e-9);
      }
    }
  });

  it("rotates orientation 6 (phone held upright) a quarter turn", () => {
    // The source's top-left must land at the destination's top-right.
    const m = orientationTransform(6, W, H);
    expect(apply(m, 0, 0)).toEqual([H, 0]);
    expect(apply(m, W, 0)).toEqual([H, W]);
  });
});
