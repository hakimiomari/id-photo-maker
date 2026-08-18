/**
 * PDF sheet builder (spec §5.5). PDFs state their page size in points, and
 * print drivers honour it far more reliably than JPEG DPI headers — kiosks
 * regularly ignore JFIF density but print a PDF page true to size.
 *
 * pdf-lib is imported dynamically so it stays out of every bundle until the
 * user actually asks for a PDF.
 */

import type { SheetLayout } from "./tiler";

const POINTS_PER_MM = 72 / 25.4;

export interface SheetPdfOptions {
  layout: SheetLayout;
  /** The single photo, JPEG-encoded. Embedded once, drawn per position. */
  photoJpeg: Uint8Array;
  /** Document title metadata. */
  title?: string;
}

export async function buildSheetPdf(options: SheetPdfOptions): Promise<Uint8Array> {
  const { layout, photoJpeg } = options;
  const { PDFDocument, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  doc.setTitle(options.title ?? "ID photo print sheet");
  doc.setProducer("ID Photo Maker");
  doc.setCreator("ID Photo Maker (client-side)");

  const pageWidth = layout.sheetWidth_mm * POINTS_PER_MM;
  const pageHeight = layout.sheetHeight_mm * POINTS_PER_MM;
  const page = doc.addPage([pageWidth, pageHeight]);

  const image = await doc.embedJpg(photoJpeg);
  const photoW = layout.photoWidth_mm * POINTS_PER_MM;
  const photoH = layout.photoHeight_mm * POINTS_PER_MM;

  // PDF's origin is bottom-left; the layout's is top-left.
  const toY = (yTopMm: number, heightMm: number) =>
    pageHeight - (yTopMm + heightMm) * POINTS_PER_MM;

  for (const position of layout.positions) {
    page.drawImage(image, {
      x: position.x_mm * POINTS_PER_MM,
      y: toY(position.y_mm, layout.photoHeight_mm),
      width: photoW,
      height: photoH,
    });
  }

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
