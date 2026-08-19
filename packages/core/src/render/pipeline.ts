/**
 * Canvas render pipeline: source bitmap + crop rect -> final photo canvas.
 * Runs in a worker on OffscreenCanvas wherever available.
 */

import { createCanvas, get2d, type AnyCanvas } from "../ingest/canvas";

import { exportPixelSize } from "../geometry/units";
import type { PhotoFormat, Rect } from "../types";

export interface ImageAdjustments {
  /** 1 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
}

export const NEUTRAL_ADJUSTMENTS: ImageAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
};

export const BACKGROUND_FILLS: Record<string, string> = {
  white: "#FFFFFF",
  off_white: "#FAFAF7",
  light_grey: "#F0F0F0",
  blue: "#8FB8DE",
  red: "#D64545",
  any: "#FFFFFF",
};

/** Photos render from the decoded bitmap or from a matte-composed canvas. */
export type RenderSource = ImageBitmap | AnyCanvas;

export interface RenderOptions {
  source: RenderSource;
  /** Crop rectangle in *source* pixels. */
  crop: Rect;
  /** Output size in pixels. */
  output: { width: number; height: number };
  adjustments?: ImageAdjustments;
  /**
   * Painted underneath the photo. Only visible once background removal (Phase 3)
   * has produced an alpha matte; harmless otherwise.
   */
  backgroundFill?: string;
}

function filterString(adj: ImageAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 1) parts.push(`brightness(${adj.brightness})`);
  if (adj.contrast !== 1) parts.push(`contrast(${adj.contrast})`);
  if (adj.saturation !== 1) parts.push(`saturate(${adj.saturation})`);
  return parts.length ? parts.join(" ") : "none";
}

/** Render the final photo. The caller owns and must release the returned canvas. */
export function renderPhoto(options: RenderOptions): AnyCanvas {
  const { source, crop, output } = options;
  const adjustments = options.adjustments ?? NEUTRAL_ADJUSTMENTS;

  const canvas = createCanvas(output.width, output.height);
  const ctx = get2d(canvas, { alpha: Boolean(options.backgroundFill) });

  if (options.backgroundFill) {
    ctx.fillStyle = options.backgroundFill;
    ctx.fillRect(0, 0, output.width, output.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = filterString(adjustments);

  // Clamp the crop to the source: drawImage with an out-of-bounds source rect
  // is defined but produces transparent padding, which would silently shift the
  // subject relative to the guides.
  const sx = Math.max(0, Math.min(crop.x, source.width));
  const sy = Math.max(0, Math.min(crop.y, source.height));
  const sw = Math.max(1, Math.min(crop.width, source.width - sx));
  const sh = Math.max(1, Math.min(crop.height, source.height - sy));

  ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, output.width, output.height);
  ctx.filter = "none";

  return canvas;
}

/** Convenience: render at a format's target DPI. */
export function renderForFormat(
  source: RenderSource,
  crop: Rect,
  format: PhotoFormat,
  options: {
    dpi?: number;
    adjustments?: ImageAdjustments;
    backgroundFill?: string;
  } = {},
): { canvas: AnyCanvas; width: number; height: number; dpi: number } {
  const dpi = options.dpi ?? format.target_dpi;
  const output = exportPixelSize(format.width_mm, format.height_mm, dpi);
  const canvas = renderPhoto({
    source,
    crop,
    output,
    adjustments: options.adjustments,
    backgroundFill: options.backgroundFill,
  });
  return { canvas, width: output.width, height: output.height, dpi };
}
