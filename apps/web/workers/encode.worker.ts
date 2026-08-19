/// <reference lib="webworker" />
/**
 * Export render + encode, for single photos and print sheets. The
 * full-resolution canvases are created here, at the moment of export, and
 * released immediately afterwards (§6.2).
 */

import {
  buildSheetPdf,
  canvasToBlob,
  composeWithMatte,
  encodeCanvas,
  encodeWithinBytes,
  getPaper,
  layoutSheet,
  releaseCanvas,
  renderForFormat,
  renderPhoto,
  renderSheet,
  type AnyCanvas,
  type RenderSource,
} from "@photomaker/core";
import type { MattePayload } from "../lib/messages";
import type {
  EncodeRequest,
  EncodeResponse,
  SheetRequest,
  SheetResponse,
} from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

type Request = EncodeRequest | SheetRequest;

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

ctx.addEventListener("message", async (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request?.type === "encode") return handleEncode(request);
  if (request?.type === "sheet") return handleSheet(request);
});

async function handleEncode(request: EncodeRequest): Promise<void> {
  let composed: AnyCanvas | null = null;
  try {
    const digital = request.digital;
    const prepared = matteSource(request.source, request.matte);
    composed = prepared.composed;
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
    if (composed) releaseCanvas(composed);
    composed = null;

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
    if (composed) releaseCanvas(composed);
    fail(request, error, "encode-failed", "The photo could not be exported.");
  }
}

async function handleSheet(request: SheetRequest): Promise<void> {
  let composed: AnyCanvas | null = null;
  try {
    const layout = layoutSheet(request.format, getPaper(request.paperId));

    const prepared = matteSource(request.source, request.matte);
    composed = prepared.composed;
    // Render the single photo once at print resolution; both outputs reuse it.
    const photo = renderForFormat(prepared.src, request.crop, request.format, {
      dpi: request.dpi,
      adjustments: request.adjustments,
      backgroundFill: request.backgroundFill,
    });
    if (composed) releaseCanvas(composed);
    composed = null;

    let blob: Blob;
    if (request.output === "pdf") {
      const jpeg = await canvasToBlob(photo.canvas, "image/jpeg", 0.92);
      releaseCanvas(photo.canvas);
      const bytes = await buildSheetPdf({
        layout,
        photoJpeg: new Uint8Array(await jpeg.arrayBuffer()),
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
    if (composed) releaseCanvas(composed);
    fail(request, error, "sheet-failed", "The print sheet could not be created.");
  }
}

function fail(
  request: Request,
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
