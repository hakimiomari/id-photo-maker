/**
 * Minimal EXIF orientation reader.
 *
 * We only ever *read* orientation, and only to bake the rotation into the
 * working bitmap. Exports are drawn to a canvas, which produces files with no
 * EXIF at all — that is the privacy guarantee, not an accident (§5.1).
 */

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const SOI = 0xffd8;
const APP1 = 0xffe1;
const ORIENTATION_TAG = 0x0112;

/** Returns the EXIF orientation of a JPEG, or 1 when absent/unparseable. */
export async function readExifOrientation(blob: Blob): Promise<ExifOrientation> {
  // Orientation lives in IFD0, always near the start of the file.
  const head = await blob.slice(0, Math.min(blob.size, 128 * 1024)).arrayBuffer();
  try {
    return parseExifOrientation(head);
  } catch {
    return 1;
  }
}

export function parseExifOrientation(buffer: ArrayBuffer): ExifOrientation {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== SOI) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) return 1; // desynchronised
    const size = view.getUint16(offset + 2);
    if (marker === APP1) {
      const exifStart = offset + 4;
      // "Exif\0\0"
      if (
        exifStart + 6 <= view.byteLength &&
        view.getUint32(exifStart) === 0x45786966
      ) {
        return readOrientationFromTiff(view, exifStart + 6);
      }
    }
    offset += 2 + size;
  }
  return 1;
}

function readOrientationFromTiff(
  view: DataView,
  tiffStart: number,
): ExifOrientation {
  if (tiffStart + 8 > view.byteLength) return 1;
  const endian = view.getUint16(tiffStart);
  const little = endian === 0x4949;
  if (!little && endian !== 0x4d4d) return 1;

  const ifdOffset = view.getUint32(tiffStart + 4, little);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > view.byteLength) return 1;

  const entries = view.getUint16(ifdStart, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) return 1;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? (value as ExifOrientation) : 1;
    }
  }
  return 1;
}

/** True when the orientation swaps width and height. */
export function orientationSwapsAxes(orientation: ExifOrientation): boolean {
  return orientation >= 5;
}

/**
 * Canvas transform that maps an unrotated image of `width` x `height` into an
 * upright drawing. Apply before `drawImage(img, 0, 0)`.
 */
export function orientationTransform(
  orientation: ExifOrientation,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}
