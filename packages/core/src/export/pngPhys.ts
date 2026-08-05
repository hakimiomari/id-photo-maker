/**
 * PNG physical-pixel-dimensions (pHYs) chunk injection — spec §6.1.
 *
 * pHYs payload: ppuX uint32 BE, ppuY uint32 BE, unit uint8 (1 = metre).
 * The chunk must appear before the first IDAT.
 */

import { dpiToPpm, ppmToDpi } from "../geometry/units";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crcTable[(crc ^ (bytes[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hasSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

function chunkType(bytes: Uint8Array, start: number): string {
  return String.fromCharCode(
    bytes[start + 4] as number,
    bytes[start + 5] as number,
    bytes[start + 6] as number,
    bytes[start + 7] as number,
  );
}

function buildPhysChunk(dpi: number): Uint8Array {
  const ppm = dpiToPpm(dpi);
  const chunk = new Uint8Array(4 + 4 + 9 + 4); // length + type + payload + crc
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/**
 * Insert or replace the pHYs chunk so the PNG declares `dpi`.
 * @returns a new ArrayBuffer; the input is not modified.
 */
export function setPngDensity(input: ArrayBuffer, dpi: number): ArrayBuffer {
  const density = Math.round(dpi);
  if (!Number.isFinite(density) || density < 1) {
    throw new Error(`setPngDensity: DPI out of range (${dpi})`);
  }

  const bytes = new Uint8Array(input);
  if (!hasSignature(bytes)) {
    throw new Error("setPngDensity: not a PNG (bad signature)");
  }

  const view = new DataView(input);
  const chunk = buildPhysChunk(density);

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = chunkType(bytes, offset);
    const total = 12 + length;

    if (type === "pHYs") {
      const out = new Uint8Array(bytes.length - total + chunk.length);
      out.set(bytes.subarray(0, offset), 0);
      out.set(chunk, offset);
      out.set(bytes.subarray(offset + total), offset + chunk.length);
      return out.buffer;
    }

    if (type === "IDAT" || type === "IEND") {
      const out = new Uint8Array(bytes.length + chunk.length);
      out.set(bytes.subarray(0, offset), 0);
      out.set(chunk, offset);
      out.set(bytes.subarray(offset), offset + chunk.length);
      return out.buffer;
    }

    offset += total;
  }

  throw new Error("setPngDensity: no IDAT chunk found");
}

export interface PngDensity {
  ppuX: number;
  ppuY: number;
  unit: number;
  dpiX: number;
  dpiY: number;
}

export function readPngDensity(input: ArrayBuffer): PngDensity | null {
  const bytes = new Uint8Array(input);
  if (!hasSignature(bytes)) return null;
  const view = new DataView(input);

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = chunkType(bytes, offset);
    if (type === "pHYs") {
      const ppuX = view.getUint32(offset + 8);
      const ppuY = view.getUint32(offset + 12);
      return {
        ppuX,
        ppuY,
        unit: bytes[offset + 16] ?? 0,
        dpiX: ppmToDpi(ppuX),
        dpiY: ppmToDpi(ppuY),
      };
    }
    if (type === "IEND") return null;
    offset += 12 + length;
  }
  return null;
}
