/**
 * PDF sheet builder (spec §5.5). PDFs state their page size in points, and
 * print drivers honour it far more reliably than JPEG DPI headers — kiosks
 * regularly ignore JFIF density but print a PDF page true to size.
 *
 * pdf-lib is imported dynamically so it stays out of every bundle until the
 * user actually asks for a PDF.
 */

import { assignCells } from "./mixed";
import type { SheetLayout } from "./tiler";

const POINTS_PER_MM = 72 / 25.4;

export interface SheetPdfOptions {
  layout: SheetLayout;
  /**
   * JPEG-encoded photos, one per batch member (a single entry for the normal
   * case). Each is embedded once and drawn per assigned cell.
   */
  photos: readonly Uint8Array[];
  /** Member index per cell; defaults to a fair contiguous split. */
  assignment?: readonly number[];
  /** Document title metadata. */
  title?: string;
}

export async function buildSheetPdf(options: SheetPdfOptions): Promise<Uint8Array> {
  const { layout, photos } = options;
  if (photos.length === 0) throw new Error("buildSheetPdf: no photos given");
  const assignment =
    options.assignment ?? assignCells(layout.copies, photos.length);
  if (assignment.length !== layout.positions.length) {
    throw new Error(
      `buildSheetPdf: assignment covers ${assignment.length} cells, layout has ${layout.positions.length}`,
    );
  }
  const { PDFDocument, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  doc.setTitle(options.title ?? "ID photo print sheet");
  doc.setProducer("ID Photo Maker");
  doc.setCreator("ID Photo Maker (client-side)");

  const pageWidth = layout.sheetWidth_mm * POINTS_PER_MM;
  const pageHeight = layout.sheetHeight_mm * POINTS_PER_MM;
  const page = doc.addPage([pageWidth, pageHeight]);

  const images = await Promise.all(photos.map((jpeg) => doc.embedJpg(jpeg)));
  const photoW = layout.photoWidth_mm * POINTS_PER_MM;
  const photoH = layout.photoHeight_mm * POINTS_PER_MM;

  // PDF's origin is bottom-left; the layout's is top-left.
  const toY = (yTopMm: number, heightMm: number) =>
    pageHeight - (yTopMm + heightMm) * POINTS_PER_MM;

  layout.positions.forEach((position, index) => {
    const image = images[assignment[index] as number];
    if (!image) {
      throw new Error(`buildSheetPdf: cell ${index} assigned to a missing photo`);
    }
    page.drawImage(image, {
      x: position.x_mm * POINTS_PER_MM,
      y: toY(position.y_mm, layout.photoHeight_mm),
      width: photoW,
      height: photoH,
    });
  });

  const hairline = rgb(0.62, 0.65, 0.7);
  for (const mark of layout.cutMarks) {
    page.drawLine({
      start: {
        x: mark.x1_mm * POINTS_PER_MM,
        y: pageHeight - mark.y1_mm * POINTS_PER_MM,
      },
      end: {
        x: mark.x2_mm * POINTS_PER_MM,
        y: pageHeight - mark.y2_mm * POINTS_PER_MM,
      },
      thickness: 0.4,
      color: hairline,
    });
  }

  return doc.save();
}
