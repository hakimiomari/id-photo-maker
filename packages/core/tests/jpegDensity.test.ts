import { describe, expect, it } from "vitest";
import { readJpegDensity, setJpegDensity } from "../src/export/jpegDensity";

/** SOI + JFIF APP0 (density 1:1, units 0) + a DQT-ish segment + EOI. */
function jpegWithJfif(): ArrayBuffer {
  const bytes = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, // APP0, length 16
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, // version
    0x00, // units: none
    0x00, 0x01, // Xdensity 1
    0x00, 0x01, // Ydensity 1
    0x00, 0x00, // no thumbnail
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, // dummy DQT
    0xff, 0xd9, // EOI
  ]);
  return bytes.buffer;
}

/** A JPEG with no JFIF APP0 at all (Chrome's canvas encoder emits these). */
function jpegWithoutJfif(): ArrayBuffer {
  const bytes = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, // dummy DQT
    0xff, 0xda, 0x00, 0x04, 0x00, 0x00, // SOS
    0x12, 0x34, 0x56, // entropy-coded data
    0xff, 0xd9, // EOI
  ]);
  return bytes.buffer;
}

describe("setJpegDensity", () => {
  it("patches an existing JFIF APP0 in place", () => {
    const out = setJpegDensity(jpegWithJfif(), 600);
    expect(readJpegDensity(out)).toEqual({ units: 1, x: 600, y: 600 });
    expect(out.byteLength).toBe(jpegWithJfif().byteLength);
  });

  it("does not mutate the caller's buffer", () => {
    const input = jpegWithJfif();
    setJpegDensity(input, 600);
    expect(readJpegDensity(input)).toEqual({ units: 0, x: 1, y: 1 });
  });

  it("inserts a JFIF APP0 when the encoder omitted one", () => {
    const input = jpegWithoutJfif();
    const out = setJpegDensity(input, 300);
    expect(out.byteLength).toBe(input.byteLength + 18);
    expect(readJpegDensity(out)).toEqual({ units: 1, x: 300, y: 300 });

    // SOI must still come first, and the original segments must survive intact.
    const bytes = new Uint8Array(out);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    expect(Array.from(bytes.subarray(20))).toEqual(
      Array.from(new Uint8Array(input).subarray(2)),
    );
  });

  it("stops scanning at SOS instead of walking into entropy data", () => {
    // The dummy entropy bytes above contain no valid markers; a parser that
    // continued past SOS would throw or mis-detect. It must simply insert.
    expect(() => setJpegDensity(jpegWithoutJfif(), 600)).not.toThrow();
  });

  it("round trips every DPI we ship", () => {
    for (const dpi of [72, 200, 300, 600, 1200]) {
      expect(readJpegDensity(setJpegDensity(jpegWithJfif(), dpi))?.x).toBe(dpi);
    }
  });

  it("rejects non-JPEG input", () => {
    expect(() => setJpegDensity(new Uint8Array([1, 2, 3, 4]).buffer, 600)).toThrow(
      /not a JPEG/,
    );
  });

  it("rejects an out-of-range DPI", () => {
    expect(() => setJpegDensity(jpegWithJfif(), 0)).toThrow(/out of range/);
    expect(() => setJpegDensity(jpegWithJfif(), 70000)).toThrow(/out of range/);
  });
});

describe("readJpegDensity", () => {
  it("returns null when there is no JFIF segment", () => {
    expect(readJpegDensity(jpegWithoutJfif())).toBeNull();
  });
});
