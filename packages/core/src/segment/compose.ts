/**
 * Matte compositing: photo + alpha mask + background fill → composed canvas.
 * Canvas-dependent (worker/browser); the pure math lives in matting.ts.
 */

import { createCanvas, get2d, releaseCanvas, type AnyCanvas } from "../ingest/canvas";
import { bilinearResizeAlpha } from "./matting";
import type { Size } from "../types";

export interface MatteOptions {
  /** 8-bit alpha, row-major, at `maskSize`. */
  mask: Uint8Array;
  maskSize: Size;
  /** Background paint; null keeps transparency (PNG use-case). */
  fill: string | null;
  /** Edge feather radius in *target* pixels (spec: 0–3 at working res). */
  feather: number;
}

/** Build a canvas holding the mask as alpha, resized to `target`. */
export function maskToCanvas(
  mask: Uint8Array,
  maskSize: Size,
  target: Size,
): AnyCanvas {
  const resized =
    maskSize.width === target.width && maskSize.height === target.height
      ? mask
      : bilinearResizeAlpha(mask, maskSize, target);

  const canvas = createCanvas(target.width, target.height);
  const ctx = get2d(canvas);
  const image = ctx.createImageData(target.width, target.height);
  for (let i = 0; i < resized.length; i++) {
    image.data[i * 4 + 3] = resized[i] as number;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Compose `photo` over `fill` through the matte. Returns a new canvas of the
 * photo's size; the caller owns and must release it.
 */
export function composeWithMatte(
  photo: CanvasImageSource & { width: number; height: number },
  options: MatteOptions,
): AnyCanvas {
  const target: Size = { width: photo.width, height: photo.height };
  const maskCanvas = maskToCanvas(options.mask, options.maskSize, target);

  // Cut the photo by the (optionally feathered) matte…
  const cut = createCanvas(target.width, target.height);
  const cutCtx = get2d(cut);
  cutCtx.drawImage(photo, 0, 0, target.width, target.height);
  cutCtx.globalCompositeOperation = "destination-in";
  if (options.feather > 0) cutCtx.filter = `blur(${options.feather}px)`;
  cutCtx.drawImage(maskCanvas as CanvasImageSource, 0, 0);
  cutCtx.filter = "none";
  cutCtx.globalCompositeOperation = "source-over";
  releaseCanvas(maskCanvas);

  // …and lay it over the background fill.
  const out = createCanvas(target.width, target.height);
  const outCtx = get2d(out);
  if (options.fill) {
    outCtx.fillStyle = options.fill;
    outCtx.fillRect(0, 0, target.width, target.height);
  }
  outCtx.drawImage(cut as CanvasImageSource, 0, 0);
  releaseCanvas(cut);
  return out;
}
