/**
 * Print-sheet tiler (spec §5.5): tile N copies of a photo onto a paper size
 * with gaps, an outer margin, and cut marks. Pure math in millimetres — the
 * canvas renderer and the PDF builder both consume this one layout.
 */

import type { PhotoFormat } from "../types";
import type { PaperSize } from "./papers";

export const SHEET_GAP_MM = 2;
export const SHEET_MARGIN_MM = 3;

export interface SheetPosition {
  x_mm: number;
  y_mm: number;
}

/** A hairline cut-mark segment in sheet coordinates. */
export interface CutMark {
  x1_mm: number;
  y1_mm: number;
  x2_mm: number;
  y2_mm: number;
}

export interface SheetLayout {
  paper: PaperSize;
  /** Sheet dimensions after orientation choice (paper may be turned). */
  sheetWidth_mm: number;
  sheetHeight_mm: number;
  landscape: boolean;
  columns: number;
  rows: number;
  copies: number;
  photoWidth_mm: number;
  photoHeight_mm: number;
  /** Top-left corner of every photo. */
  positions: SheetPosition[];
  cutMarks: CutMark[];
  gap_mm: number;
  margin_mm: number;
}

export interface TilerOptions {
  gap_mm?: number;
  margin_mm?: number;
}

function fitCount(available: number, cell: number, gap: number): number {
  if (cell > available) return 0;
  // n cells and n-1 gaps must fit: n*cell + (n-1)*gap <= available
  return Math.floor((available + gap) / (cell + gap));
}

interface GridAttempt {
  columns: number;
  rows: number;
  copies: number;
  sheetWidth: number;
  sheetHeight: number;
  landscape: boolean;
}

function attempt(
  format: PhotoFormat,
  sheetWidth: number,
  sheetHeight: number,
  landscape: boolean,
  gap: number,
  margin: number,
): GridAttempt {
  const columns = fitCount(sheetWidth - 2 * margin, format.width_mm, gap);
  const rows = fitCount(sheetHeight - 2 * margin, format.height_mm, gap);
  return {
    columns,
    rows,
    copies: columns * rows,
    sheetWidth,
    sheetHeight,
    landscape,
  };
}

/**
 * Lay out as many copies as fit. Photos stay upright — rotating individual
 * photos would save paper occasionally but makes cutting error-prone; instead
 * the whole sheet may turn landscape when that fits more copies.
 */
export function layoutSheet(
  format: PhotoFormat,
  paper: PaperSize,
  options: TilerOptions = {},
): SheetLayout {
  const gap = options.gap_mm ?? SHEET_GAP_MM;
  const margin = options.margin_mm ?? SHEET_MARGIN_MM;

  const portrait = attempt(
    format,
    paper.width_mm,
    paper.height_mm,
    false,
    gap,
    margin,
  );
  const landscape = attempt(
    format,
    paper.height_mm,
    paper.width_mm,
    true,
    gap,
    margin,
  );
  const best = landscape.copies > portrait.copies ? landscape : portrait;

  if (best.copies === 0) {
    throw new Error(
      `layoutSheet: a ${format.width_mm}×${format.height_mm} mm photo does not fit on ${paper.id}`,
    );
  }

  const { columns, rows, sheetWidth, sheetHeight } = best;
  const gridWidth = columns * format.width_mm + (columns - 1) * gap;
  const gridHeight = rows * format.height_mm + (rows - 1) * gap;
  const offsetX = (sheetWidth - gridWidth) / 2;
  const offsetY = (sheetHeight - gridHeight) / 2;

  const positions: SheetPosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      positions.push({
        x_mm: offsetX + col * (format.width_mm + gap),
        y_mm: offsetY + row * (format.height_mm + gap),
      });
    }
  }

  return {
    paper,
    sheetWidth_mm: sheetWidth,
    sheetHeight_mm: sheetHeight,
    landscape: best.landscape,
    columns,
    rows,
    copies: best.copies,
    photoWidth_mm: format.width_mm,
    photoHeight_mm: format.height_mm,
    positions,
    cutMarks: buildCutMarks({
      sheetWidth,
      sheetHeight,
      offsetX,
      offsetY,
      columns,
      rows,
      cellW: format.width_mm,
      cellH: format.height_mm,
      gap,
    }),
    gap_mm: gap,
    margin_mm: margin,
  };
}

interface CutMarkInput {
  sheetWidth: number;
  sheetHeight: number;
  offsetX: number;
  offsetY: number;
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  gap: number;
}

/**
 * Cut marks are ticks in the outer margins only — never across photos, and not
 * inside the gaps, so a slightly offset cut cannot expose a printed line on a
 * kept photo. Connect opposite ticks with a ruler to cut.
 */
function buildCutMarks(input: CutMarkInput): CutMark[] {
  const { sheetWidth, sheetHeight, offsetX, offsetY, columns, rows, cellW, cellH, gap } =
    input;
  const marks: CutMark[] = [];

  const gridTop = offsetY;
  const gridBottom = offsetY + rows * cellH + (rows - 1) * gap;
  const gridLeft = offsetX;
  const gridRight = offsetX + columns * cellW + (columns - 1) * gap;

  // Tick length: fill most of the margin but keep 0.5 mm clear of both the
  // sheet edge (printers clip borderless edges) and the photos themselves.
  const PAD = 0.5;

  const verticalEdges = new Set<number>();
  for (let col = 0; col < columns; col++) {
    const left = offsetX + col * (cellW + gap);
    verticalEdges.add(left);
    verticalEdges.add(left + cellW);
  }
  for (const x of verticalEdges) {
    marks.push({ x1_mm: x, y1_mm: PAD, x2_mm: x, y2_mm: gridTop - PAD });
    marks.push({
      x1_mm: x,
      y1_mm: gridBottom + PAD,
      x2_mm: x,
      y2_mm: sheetHeight - PAD,
    });
  }

  const horizontalEdges = new Set<number>();
  for (let row = 0; row < rows; row++) {
    const top = offsetY + row * (cellH + gap);
    horizontalEdges.add(top);
    horizontalEdges.add(top + cellH);
  }
  for (const y of horizontalEdges) {
    marks.push({ x1_mm: PAD, y1_mm: y, x2_mm: gridLeft - PAD, y2_mm: y });
    marks.push({
      x1_mm: gridRight + PAD,
      y1_mm: y,
      x2_mm: sheetWidth - PAD,
      y2_mm: y,
    });
  }

  return marks;
}
