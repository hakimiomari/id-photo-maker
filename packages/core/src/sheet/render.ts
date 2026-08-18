/**
 * Rasterize a sheet layout to a canvas for JPEG export. The photo is rendered
 * once by the caller (render/pipeline.ts) and stamped per position here.
 */

import { createCanvas, get2d, type AnyCanvas } from "../ingest/canvas";
import { mmToPx } from "../geometry/units";
import type { SheetLayout } from "./tiler";

export interface SheetRenderResult {
  canvas: AnyCanvas;
  width: number;
  height: number;
  dpi: number;
}

export function renderSheet(
  photo: AnyCanvas,
  layout: SheetLayout,
  dpi: number,
): SheetRenderResult {
  const width = Math.round(mmToPx(layout.sheetWidth_mm, dpi));
  const height = Math.round(mmToPx(layout.sheetHeight_mm, dpi));
  const px = (mm: number) => mmToPx(mm, dpi);

  const canvas = createCanvas(width, height);
  const ctx = get2d(canvas);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const photoW = px(layout.photoWidth_mm);
  const photoH = px(layout.photoHeight_mm);
  for (const position of layout.positions) {
    ctx.drawImage(
      photo as CanvasImageSource,
      px(position.x_mm),
      px(position.y_mm),
      photoW,
      photoH,
    );
  }

  // Hairline cut marks: one device pixel wide regardless of DPI.
  ctx.strokeStyle = "#9EA6B0";
  ctx.lineWidth = Math.max(1, Math.round(dpi / 300));
  ctx.beginPath();
  for (const mark of layout.cutMarks) {
    ctx.moveTo(px(mark.x1_mm), px(mark.y1_mm));
    ctx.lineTo(px(mark.x2_mm), px(mark.y2_mm));
  }
  ctx.stroke();

  return { canvas, width, height, dpi };
}
