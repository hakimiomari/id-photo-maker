/**
 * Two-resolution strategy (§2.4): detection and the editor run on a working
 * copy of at most WORKING_MAX_EDGE px; the original bitmap is kept only until
 * export, then released.
 */

import { createCanvas, get2d, releaseCanvas } from "./canvas";
import type { Size } from "../types";

export const WORKING_MAX_EDGE = 2048;

export interface WorkingCopy {
  bitmap: ImageBitmap;
  size: Size;
  /** source px per working px — multiply working coords by this to get source coords. */
  sourceScale: number;
}

export function fitWithin(size: Size, maxEdge: number): Size {
  const longEdge = Math.max(size.width, size.height);
  if (longEdge <= maxEdge) return { ...size };
  const factor = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  };
}

/**
 * Produce a working copy. The source bitmap is left open — the caller decides
 * when to close it, because export still needs it.
 */
export async function makeWorkingCopy(
  source: ImageBitmap,
  maxEdge = WORKING_MAX_EDGE,
): Promise<WorkingCopy> {
  const target = fitWithin(
    { width: source.width, height: source.height },
    maxEdge,
  );

  if (target.width === source.width && target.height === source.height) {
    return {
      bitmap: source,
      size: target,
      sourceScale: 1,
    };
  }

  // resizeQuality "high" gives a properly filtered downscale; without it large
  // reductions alias badly and the landmarker gets noticeably worse.
  const bitmap = await createImageBitmap(source, {
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: "high",
  });

  return {
    bitmap,
    size: { width: bitmap.width, height: bitmap.height },
    sourceScale: source.width / bitmap.width,
  };
}

/** Draw a bitmap into an ImageData buffer (for mask work and pixel stats). */
export function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = get2d(canvas, { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  releaseCanvas(canvas);
  return data;
}
