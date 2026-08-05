/**
 * Encoding + physical-size metadata. Every export leaves this module with a
 * correct DPI stamp; nothing else in the codebase may call canvasToBlob for a
 * user-facing download.
 */

import { canvasToBlob, releaseCanvas, type AnyCanvas } from "../ingest/canvas";
import { setJpegDensity } from "./jpegDensity";
import { setPngDensity } from "./pngPhys";
import type { PhotoFormat } from "../types";

export type ExportMime = "image/jpeg" | "image/png";

export const DEFAULT_JPEG_QUALITY = 0.92;

export interface EncodeOptions {
  mimeType?: ExportMime;
  quality?: number;
  dpi: number;
  /** Release the canvas after encoding (default true) — iOS memory discipline. */
  release?: boolean;
}

export interface EncodedImage {
  blob: Blob;
  mimeType: ExportMime;
  dpi: number;
  bytes: number;
}

/** Encode a canvas and stamp its physical resolution. */
export async function encodeCanvas(
  canvas: AnyCanvas,
  options: EncodeOptions,
): Promise<EncodedImage> {
  const mimeType = options.mimeType ?? "image/jpeg";
  const quality = options.quality ?? DEFAULT_JPEG_QUALITY;

  try {
    const raw = await canvasToBlob(canvas, mimeType, quality);
    const buffer = await raw.arrayBuffer();
    const stamped =
      mimeType === "image/png"
        ? setPngDensity(buffer, options.dpi)
        : setJpegDensity(buffer, options.dpi);
    return {
      blob: new Blob([stamped], { type: mimeType }),
      mimeType,
      dpi: options.dpi,
      bytes: stamped.byteLength,
    };
  } finally {
    if (options.release !== false) releaseCanvas(canvas);
  }
}

/**
 * Encode to fit a byte ceiling by stepping JPEG quality down (§5.5, digital
 * upload specs such as the 40–120 KB China visa photo). Returns the best
 * quality that fits, or the smallest attempt if nothing fits.
 */
export async function encodeWithinBytes(
  canvas: AnyCanvas,
  maxBytes: number,
  options: EncodeOptions,
): Promise<EncodedImage> {
  const qualities = [options.quality ?? DEFAULT_JPEG_QUALITY, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4];
  let last: EncodedImage | null = null;

  for (const quality of qualities) {
    const encoded = await encodeCanvas(canvas, {
      ...options,
      mimeType: "image/jpeg",
      quality,
      release: false,
    });
    last = encoded;
    if (encoded.bytes <= maxBytes) break;
  }

  if (options.release !== false) releaseCanvas(canvas);
  if (!last) throw new Error("encodeWithinBytes: no encode attempted");
  return last;
}

/** `photo-us-passport-51x51mm.jpg` */
export function exportFilename(
  format: PhotoFormat,
  mimeType: ExportMime,
  suffix?: string,
): string {
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const size = `${format.width_mm}x${format.height_mm}mm`;
  return `photo-${format.id}-${size}${suffix ? `-${suffix}` : ""}.${extension}`;
}
