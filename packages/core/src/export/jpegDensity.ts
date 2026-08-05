/**
 * JPEG density (DPI) metadata — REQUIRED, see spec §6.1.
 *
 * `canvas.toBlob()` writes no density information, so print services assume
 * 72 DPI and a 35 × 45 mm photo comes out roughly 8× too large. After encoding
 * we patch (or insert) the JFIF APP0 segment so the file states its true
 * physical size.
 *
 * JFIF APP0 layout, from the segment's first byte:
 *   +0  FF          marker
 *   +1  E0
 *   +2  length      uint16 BE (includes these 2 bytes, excludes the marker)
 *   +4  "JFIF\0"    5 bytes
 *   +9  version     2 bytes
 *   +11 units       1 byte  (0 = aspect ratio only, 1 = DPI, 2 = dots/cm)
 *   +12 Xdensity    uint16 BE
 *   +14 Ydensity    uint16 BE
 *   +16 Xthumbnail  1 byte
 *   +17 Ythumbnail  1 byte
 */

const SOI = 0xffd8;
const APP0 = 0xffe0;
const SOS = 0xffda;
const JFIF_MAGIC = [0x4a, 0x46, 0x49, 0x46, 0x00];

export const DENSITY_UNITS_DPI = 1;

export interface JpegDensity {
  units: number;
  x: number;
  y: number;
}

function isJfifApp0(bytes: Uint8Array, segmentStart: number): boolean {
  const payload = segmentStart + 4;
  if (payload + JFIF_MAGIC.length > bytes.length) return false;
  return JFIF_MAGIC.every((b, i) => bytes[payload + i] === b);
}

/**
 * Set the JFIF density fields to `dpi`, inserting a JFIF APP0 segment when the
 * encoder produced a bare JPEG without one.
 *
 * @returns a new ArrayBuffer; the input is not modified.
 */
export function setJpegDensity(input: ArrayBuffer, dpi: number): ArrayBuffer {
  const density = Math.round(dpi);
  if (!Number.isFinite(density) || density < 1 || density > 0xffff) {
    throw new Error(`setJpegDensity: DPI out of range (${dpi})`);
  }

  const bytes = new Uint8Array(input);
  const view = new DataView(input);
  if (bytes.length < 4 || view.getUint16(0) !== SOI) {
    throw new Error("setJpegDensity: not a JPEG (missing SOI)");
  }

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) break;
    if (marker === SOS) break; // entropy-coded data follows; stop scanning
    const length = view.getUint16(offset + 2);
    if (length < 2) break;

    if (marker === APP0 && isJfifApp0(bytes, offset) && offset + 16 <= bytes.length) {
      const out = new Uint8Array(bytes); // copy, keep the caller's buffer intact
      const outView = new DataView(out.buffer);
      out[offset + 11] = DENSITY_UNITS_DPI;
      outView.setUint16(offset + 12, density);
      outView.setUint16(offset + 14, density);
      return out.buffer;
    }

    offset += 2 + length;
  }

  return insertJfifApp0(bytes, density);
}

function insertJfifApp0(bytes: Uint8Array, dpi: number): ArrayBuffer {
  const segment = new Uint8Array(18);
  const segView = new DataView(segment.buffer);
  segView.setUint16(0, APP0);
  segView.setUint16(2, 16); // segment length, marker excluded
  segment.set(JFIF_MAGIC, 4);
  segment[9] = 1; // version 1.01
  segment[10] = 1;
  segment[11] = DENSITY_UNITS_DPI;
  segView.setUint16(12, dpi);
  segView.setUint16(14, dpi);
  segment[16] = 0; // no thumbnail
  segment[17] = 0;

  const out = new Uint8Array(bytes.length + segment.length);
  out.set(bytes.subarray(0, 2), 0); // SOI
  out.set(segment, 2);
  out.set(bytes.subarray(2), 2 + segment.length);
  return out.buffer;
}

/** Read back the JFIF density fields. Returns null when there is no JFIF APP0. */
export function readJpegDensity(input: ArrayBuffer): JpegDensity | null {
  const bytes = new Uint8Array(input);
  const view = new DataView(input);
  if (bytes.length < 4 || view.getUint16(0) !== SOI) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) return null;
    if (marker === SOS) return null;
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;

    if (marker === APP0 && isJfifApp0(bytes, offset) && offset + 16 <= bytes.length) {
      return {
        units: bytes[offset + 11] ?? 0,
        x: view.getUint16(offset + 12),
        y: view.getUint16(offset + 14),
      };
    }
    offset += 2 + length;
  }
  return null;
}
