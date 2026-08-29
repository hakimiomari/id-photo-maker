/**
 * Replay recorded retouch ops onto pixels at any scale — the bridge between
 * the working-resolution preview and the full-resolution export (§ops.ts).
 */

import { createCanvas, get2d, releaseCanvas, type AnyCanvas } from "../ingest/canvas";
import type { RenderSource } from "../render/pipeline";
import type { Size } from "../types";
import { healSpot } from "./heal";
import { applySmoothing } from "./smooth";
import { applyRegion } from "./region";
import { paintStrokeMask, scaleOp, type AttireTransform, type RetouchOp } from "./ops";

/**
 * Apply heal/smooth ops to a copy of `source`. Ops are in working px; `k` is
 * the source-px-per-working-px factor (1 for the preview itself).
 * Returns a new canvas the caller owns.
 */
export function applyRetouchOps(
  source: RenderSource,
  ops: readonly RetouchOp[],
  k: number,
): AnyCanvas {
  const width = source.width;
  const height = source.height;
  const canvas = createCanvas(width, height);
  const ctx = get2d(canvas, { willReadFrequently: true });
  ctx.drawImage(source as CanvasImageSource, 0, 0);
  if (ops.length === 0) return canvas;

  const image = ctx.getImageData(0, 0, width, height);
  const size: Size = { width, height };

  for (const raw of ops) {
    const op = k === 1 ? raw : scaleOp(raw, k);
    if (op.kind === "heal") {
      healSpot(image.data, size, op);
    } else if (op.kind === "region") {
      applyRegion(image.data, size, op);
    } else {
      const mask = new Uint8Array(width * height);
      paintStrokeMask(mask, size, op);
      applySmoothing(image.data, size, mask, Math.max(1.5, op.radius * 0.35), op.strength);
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Draw the uploaded attire overlay with its placement, scaled by `k`. */
export function drawAttire(
  target: AnyCanvas,
  attire: CanvasImageSource & { width: number; height: number },
  transform: AttireTransform,
  k: number,
): void {
  const ctx = get2d(target);
  const width = transform.width * k;
  const height = (attire.height / attire.width) * width;
  ctx.save();
  ctx.translate(transform.cx * k, transform.cy * k);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(attire, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export { releaseCanvas };
