import { describe, expect, it } from "vitest";
import { crc32, readPngDensity, setPngDensity } from "../src/export/pngPhys";
import { dpiToPpm } from "../src/geometry/units";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunk(type: string, payload: number[]): number[] {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const body = Uint8Array.from([...typeBytes, ...payload]);
  const length = payload.length;
  const crc = crc32(body);
  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...body,
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff,
  ];
}

function minimalPng(extra: number[] = []): ArrayBuffer {
  const ihdr = chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const idat = chunk("IDAT", [0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x01]);
  const iend = chunk("IEND", []);
  return Uint8Array.from([...SIGNATURE, ...ihdr, ...extra, ...idat, ...iend]).buffer;
}

describe("crc32", () => {
  it("matches the reference value for IEND", () => {
    // The IEND chunk's CRC is a fixed, well-known constant.
    const iend = Uint8Array.from([0x49, 0x45, 0x4e, 0x44]);
    expect(crc32(iend)).toBe(0xae426082);
  });
});

describe("setPngDensity", () => {
  it("inserts a pHYs chunk before IDAT", () => {
    const out = setPngDensity(minimalPng(), 600);
    const density = readPngDensity(out);
    expect(density).not.toBeNull();
    expect(density?.unit).toBe(1);
    expect(density?.ppuX).toBe(dpiToPpm(600));
    expect(density?.dpiX).toBeCloseTo(600, 2);
    expect(density?.dpiY).toBeCloseTo(600, 2);

    // pHYs must precede IDAT, otherwise decoders ignore it.
    const text = new TextDecoder("latin1").decode(new Uint8Array(out));
    expect(text.indexOf("pHYs")).toBeLessThan(text.indexOf("IDAT"));
  });

  it("writes a chunk with a valid CRC", () => {
    const out = new Uint8Array(setPngDensity(minimalPng(), 300));
    const text = new TextDecoder("latin1").decode(out);
    const typeAt = text.indexOf("pHYs");
    const view = new DataView(out.buffer);
    const length = view.getUint32(typeAt - 4);
    const stored = view.getUint32(typeAt + 4 + length);
    expect(crc32(out.subarray(typeAt, typeAt + 4 + length))).toBe(stored);
    expect(length).toBe(9);
  });

  it("replaces an existing pHYs chunk rather than duplicating it", () => {
    const existing = chunk("pHYs", [0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1]); // 300 DPI
    const out = setPngDensity(minimalPng(existing), 600);
    const text = new TextDecoder("latin1").decode(new Uint8Array(out));
    expect(text.split("pHYs").length - 1).toBe(1);
    expect(readPngDensity(out)?.ppuX).toBe(dpiToPpm(600));
    expect(out.byteLength).toBe(minimalPng(existing).byteLength);
  });

  it("does not mutate the caller's buffer", () => {
    const input = minimalPng();
    setPngDensity(input, 600);
    expect(readPngDensity(input)).toBeNull();
  });

  it("rejects non-PNG input", () => {
    expect(() => setPngDensity(new Uint8Array([1, 2, 3, 4]).buffer, 600)).toThrow(
      /not a PNG/,
    );
  });
});

describe("readPngDensity", () => {
  it("returns null when no pHYs chunk is present", () => {
    expect(readPngDensity(minimalPng())).toBeNull();
  });
});
