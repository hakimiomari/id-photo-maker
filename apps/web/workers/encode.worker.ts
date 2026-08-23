/// <reference lib="webworker" />
/**
 * Export render + encode, for single photos and print sheets. The
 * full-resolution canvases are created here, at the moment of export, and
 * released immediately afterwards (§6.2).
 */

import {
  applyRetouchOps,
  assignCells,
  drawAttire,
  buildSheetPdf,
  canvasToBlob,
  countsPerMember,
  composeWithMatte,
  encodeCanvas,
  encodeWithinBytes,
  getPaper,
  layoutSheet,
  releaseCanvas,
  renderForFormat,
  renderMixedSheet,
  renderPhoto,
  renderSheet,
  type AnyCanvas,
  type RenderSource,
} from "@photomaker/core";
import type { MattePayload, RetouchPayload } from "../lib/messages";
import type {
  BatchSheetRequest,
  BatchSheetResponse,
  EncodeRequest,
  EncodeResponse,
  SheetRequest,
  SheetResponse,
} from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

type Request = EncodeRequest | SheetRequest | BatchSheetRequest;

/**
 * Background replacement (§5.3): compose the full-resolution source through
 * the working-res matte (bilinear upsample happens inside composeWithMatte).
 * Feather scales with resolution, minimum 1 px at export.
 */
function matteSource(
  source: ImageBitmap,
  matte: MattePayload | undefined,
): { src: RenderSource; composed: AnyCanvas | null } {
  if (!matte) return { src: source, composed: null };
  const scale = source.width / matte.width;
  const composed = composeWithMatte(source, {
    mask: matte.data,
    maskSize: { width: matte.width, height: matte.height },
    fill: matte.fill,
    feather: Math.max(1, Math.round(matte.feather * scale)),
  });
  return { src: composed, composed };
}

/**
 * Manual retouch (heal/smooth, then the attire overlay) replayed at source
 * resolution. Runs before the matte so healed skin also feeds the cut-out;
 * attire is drawn after the matte in prepareSource so it sits on top of the
 * replaced background.
 */
async function retouchedSource(
  source: ImageBitmap,
  retouch: RetouchPayload | undefined,
): Promise<{ src: RenderSource; composed: AnyCanvas | null }> {
  if (!retouch || retouch.ops.length === 0) return { src: source, composed: null };
  const composed = applyRetouchOps(source, retouch.ops, retouch.scale);
  return { src: composed, composed };
}

/** Full source pipeline: retouch ops → matte → attire overlay. */
async function prepareSource(
  source: ImageBitmap,
  matte: MattePayload | undefined,
  retouch: RetouchPayload | undefined,
): Promise<{ src: RenderSource; owned: AnyCanvas[] }> {
  const owned: AnyCanvas[] = [];

  const afterOps = await retouchedSource(source, retouch);
  if (afterOps.composed) owned.push(afterOps.composed);
  let current: RenderSource = afterOps.src;

  if (matte) {
    const scale = source.width / matte.width;
    const composed = composeWithMatte(current, {
      mask: matte.data,
      maskSize: { width: matte.width, height: matte.height },
      fill: matte.fill,
      feather: Math.max(1, Math.round(matte.feather * scale)),
    });
    owned.push(composed);
    current = composed;
  }

  if (retouch?.attire) {
    // Attire must be drawn onto a canvas; wrap bitmaps as needed.
    let canvas: AnyCanvas;
    if (current instanceof ImageBitmap) {
      canvas = applyRetouchOps(current, [], 1); // plain copy
      owned.push(canvas);
    } else {
      canvas = current;
    }
    const attireBitmap = await createImageBitmap(
      new Blob([retouch.attire.bytes]),
    );
    drawAttire(canvas, attireBitmap, retouch.attire.transform, retouch.scale);
    attireBitmap.close();
    current = canvas;
  }

  return { src: current, owned };
}

ctx.addEventListener("message", async (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request?.type === "encode") return handleEncode(request);
  if (request?.type === "sheet") return handleSheet(request);
  if (request?.type === "batch-sheet") return handleBatchSheet(request);
});

async function handleBatchSheet(request: BatchSheetRequest): Promise<void> {
  const bitmaps: ImageBitmap[] = [];
  try {
    const layout = layoutSheet(request.format, getPaper(request.paperId));
    const assignment = assignCells(layout.copies, request.photos.length);
    const jpegs = request.photos.map((buffer) => new Uint8Array(buffer));

    let blob: Blob;
    if (request.output === "pdf") {
      const bytes = await buildSheetPdf({
        layout,
        photos: jpegs,
        assignment,
        title: `${request.format.id} family sheet`,
      });
      blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    } else {
      for (const jpeg of jpegs) {
        bitmaps.push(
          await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" })),
        );
      }
      const sheet = renderMixedSheet(bitmaps, layout, request.dpi, assignment);
      const encoded = await encodeCanvas(sheet.canvas, {
        mimeType: "image/jpeg",
        quality: 0.92,
        dpi: request.dpi,
      });
      blob = encoded.blob;
    }

    const response: BatchSheetResponse = {
      id: request.id,
      ok: true,
      kind: "batch",
      blob,
      bytes: blob.size,
      copies: layout.copies,
      perMember: countsPerMember(assignment, request.photos.length),
      sheetWidth_mm: layout.sheetWidth_mm,
      sheetHeight_mm: layout.sheetHeight_mm,
    };
    ctx.postMessage(response);
  } catch (error) {
    const failure: BatchSheetResponse = {
      id: request.id,
      ok: false,
      code: "batch-sheet-failed",
      message:
        error instanceof Error
          ? error.message
          : "The family sheet could not be created.",
    };
    ctx.postMessage(failure);
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
}

async function handleEncode(request: EncodeRequest): Promise<void> {
  let owned: AnyCanvas[] = [];
  try {
    const digital = request.digital;
    const prepared = await prepareSource(request.source, request.matte, request.retouch);
    owned = prepared.owned;
    const rendered = digital
      ? {
          canvas: renderPhoto({
            source: prepared.src,
            crop: request.crop,
            output: { width: digital.width, height: digital.height },
            adjustments: request.adjustments,
            backgroundFill: request.backgroundFill,
          }),
          width: digital.width,
          height: digital.height,
          // A digital upload is measured in pixels, but the file should still
          // declare a sane physical size for anyone who prints it.
          dpi: Math.round(digital.height / (request.format.height_mm / 25.4)),
        }
      : renderForFormat(prepared.src, request.crop, request.format, {
          dpi: request.dpi,
          adjustments: request.adjustments,
          backgroundFill: request.backgroundFill,
        });
    for (const canvas of owned) releaseCanvas(canvas);
    owned = [];

    const encoded = digital
      ? await encodeWithinBytes(rendered.canvas, digital.maxBytes, {
          dpi: rendered.dpi,
          quality: request.quality,
        })
      : await encodeCanvas(rendered.canvas, {
          mimeType: request.mimeType,
          quality: request.quality,
          dpi: rendered.dpi,
        });

    const response: EncodeResponse = {
      id: request.id,
      ok: true,
      blob: encoded.blob,
      bytes: encoded.bytes,
      width: rendered.width,
      height: rendered.height,
      dpi: encoded.dpi,
      source: request.source,
    };
    ctx.postMessage(response, [request.source]);
  } catch (error) {
    for (const canvas of owned) releaseCanvas(canvas);
    fail(request, error, "encode-failed", "The photo could not be exported.");
  }
}

async function handleSheet(request: SheetRequest): Promise<void> {
  let owned: AnyCanvas[] = [];
  try {
    const layout = layoutSheet(request.format, getPaper(request.paperId));

    const prepared = await prepareSource(request.source, request.matte, request.retouch);
    owned = prepared.owned;
    // Render the single photo once at print resolution; both outputs reuse it.
    const photo = renderForFormat(prepared.src, request.crop, request.format, {
      dpi: request.dpi,
      adjustments: request.adjustments,
      backgroundFill: request.backgroundFill,
    });
    for (const canvas of owned) releaseCanvas(canvas);
    owned = [];

    let blob: Blob;
    if (request.output === "pdf") {
      const jpeg = await canvasToBlob(photo.canvas, "image/jpeg", 0.92);
      releaseCanvas(photo.canvas);
      const bytes = await buildSheetPdf({
        layout,
        photos: [new Uint8Array(await jpeg.arrayBuffer())],
        title: `${request.format.id} print sheet`,
      });
      blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    } else {
      const sheet = renderSheet(photo.canvas, layout, request.dpi);
      releaseCanvas(photo.canvas);
      const encoded = await encodeCanvas(sheet.canvas, {
        mimeType: "image/jpeg",
        quality: 0.92,
        dpi: request.dpi,
      });
      blob = encoded.blob;
    }

    const response: SheetResponse = {
      id: request.id,
      ok: true,
      blob,
      bytes: blob.size,
      copies: layout.copies,
      sheetWidth_mm: layout.sheetWidth_mm,
      sheetHeight_mm: layout.sheetHeight_mm,
      source: request.source,
    };
    ctx.postMessage(response, [request.source]);
  } catch (error) {
    for (const canvas of owned) releaseCanvas(canvas);
    fail(request, error, "sheet-failed", "The print sheet could not be created.");
  }
}

function fail(
  request: EncodeRequest | SheetRequest,
  error: unknown,
  code: string,
  fallback: string,
): void {
  const failure: EncodeResponse = {
    id: request.id,
    ok: false,
    code,
    message: error instanceof Error ? error.message : fallback,
    source: request.source,
  };
  // Hand the bitmap back even on failure, or the session loses its photo.
  ctx.postMessage(failure, [request.source]);
}

export {};
