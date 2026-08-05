/**
 * Guide overlay drawing (§8.2). Every dimension here comes from the format and
 * the live crop solution — nothing about the guides is hardcoded per format.
 */

import type { CropSolution, HeadBox, PhotoFormat, Rect } from "@photomaker/core";

const HAIRLINE = "rgba(29, 78, 216, 0.55)";
const HAIRLINE_SOFT = "rgba(18, 22, 28, 0.35)";
const BAND = "rgba(29, 78, 216, 0.10)";
const LABEL = "rgba(18, 22, 28, 0.75)";

export interface OverlayContext {
  ctx: CanvasRenderingContext2D;
  /** The fixed crop frame in CSS pixels. */
  frame: Rect;
  format: PhotoFormat;
  solution: CropSolution;
  head: HeadBox;
  /** Screen px per working px. */
  k: number;
}

export function drawOverlay({
  ctx,
  frame,
  format,
  solution,
  head,
  k,
}: OverlayContext): void {
  const pxPerMm = frame.height / format.height_mm;
  const crownY = frame.y + solution.topMarginMm * pxPerMm;
  const chinY = crownY + solution.headHeightMm * pxPerMm;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font =
    "500 11px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";

  // Allowed chin band: where the chin must land for the head height to be in spec.
  if (format.head_min_mm !== null && format.head_max_mm !== null) {
    const minY = crownY + format.head_min_mm * pxPerMm;
    const maxY = crownY + format.head_max_mm * pxPerMm;
    ctx.fillStyle = BAND;
    ctx.fillRect(frame.x, minY, frame.width, maxY - minY);

    ctx.strokeStyle = HAIRLINE;
    ctx.setLineDash([4, 4]);
    for (const y of [minY, maxY]) {
      line(ctx, frame.x, y, frame.x + frame.width, y);
    }
    ctx.setLineDash([]);

    label(ctx, `${format.head_min_mm} mm`, frame.x + 6, minY - 9);
    label(ctx, `${format.head_max_mm} mm`, frame.x + 6, maxY + 9);
  }

  // Eye-line band, for formats that constrain it.
  if (format.eye_line_from_bottom_mm) {
    const [min, max] = format.eye_line_from_bottom_mm;
    const yFromBottom = (mm: number) => frame.y + frame.height - mm * pxPerMm;
    ctx.fillStyle = BAND;
    ctx.fillRect(
      frame.x,
      yFromBottom(max),
      frame.width,
      (max - min) * pxPerMm,
    );
    ctx.strokeStyle = HAIRLINE;
    ctx.setLineDash([2, 3]);
    line(ctx, frame.x, yFromBottom(min), frame.x + frame.width, yFromBottom(min));
    line(ctx, frame.x, yFromBottom(max), frame.x + frame.width, yFromBottom(max));
    ctx.setLineDash([]);
  }

  // Measured crown and chin.
  ctx.strokeStyle = HAIRLINE;
  line(ctx, frame.x, crownY, frame.x + frame.width, crownY);
  line(ctx, frame.x, chinY, frame.x + frame.width, chinY);

  // Head-height bracket on the right edge.
  const bracketX = frame.x + frame.width - 14;
  ctx.beginPath();
  ctx.moveTo(bracketX, crownY);
  ctx.lineTo(bracketX, chinY);
  ctx.moveTo(bracketX - 4, crownY);
  ctx.lineTo(bracketX + 4, crownY);
  ctx.moveTo(bracketX - 4, chinY);
  ctx.lineTo(bracketX + 4, chinY);
  ctx.stroke();

  // Measured eye line.
  const eyeY = frame.y + (head.yEyes - solution.rect.y) * k;
  ctx.strokeStyle = HAIRLINE_SOFT;
  ctx.setLineDash([2, 4]);
  line(ctx, frame.x, eyeY, frame.x + frame.width, eyeY);

  // Vertical centre.
  const centreX = frame.x + frame.width / 2;
  line(ctx, centreX, frame.y, centreX, frame.y + frame.height);
  ctx.setLineDash([]);

  ctx.restore();
}

/** The crop frame itself, plus the dimmed area outside it. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Rect,
  canvas: { width: number; height: number },
): void {
  ctx.save();
  ctx.fillStyle = "rgba(247, 248, 250, 0.86)";
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(frame.x, frame.y, frame.width, frame.height);
  ctx.fill("evenodd");

  ctx.strokeStyle = "rgba(18, 22, 28, 0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.width - 1, frame.height - 1);
  ctx.restore();
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y1) + 0.5);
  ctx.lineTo(x2, Math.round(y2) + 0.5);
  if (x1 === x2) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, y1);
    ctx.lineTo(Math.round(x2) + 0.5, y2);
  }
  ctx.stroke();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  ctx.fillStyle = LABEL;
  ctx.fillText(text, x, y);
}

/**
 * Fit a rectangle of the format's aspect ratio inside the available area.
 * The frame is fixed; the photo moves underneath it (§4.5).
 */
export function computeFrame(
  area: { width: number; height: number },
  format: PhotoFormat,
  padding = 28,
): Rect {
  const aspect = format.width_mm / format.height_mm;
  const maxWidth = Math.max(40, area.width - padding * 2);
  const maxHeight = Math.max(40, area.height - padding * 2);
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return {
    x: Math.round((area.width - width) / 2),
    y: Math.round((area.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}
