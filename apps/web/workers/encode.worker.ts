/// <reference lib="webworker" />
/**
 * Export render + encode. The full-resolution canvas is created here, at the
 * moment of export, and released immediately afterwards (§6.2).
 */

import {
  encodeCanvas,
  encodeWithinBytes,
  renderForFormat,
  renderPhoto,
} from "@photomaker/core";
import type { EncodeRequest, EncodeResponse } from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", async (event: MessageEvent<EncodeRequest>) => {
  const request = event.data;
  if (request?.type !== "encode") return;

  try {
    const digital = request.digital;
    const rendered = digital
      ? {
          canvas: renderPhoto({
            source: request.source,
            crop: request.crop,
            output: { width: digital.width, height: digital.height },
            adjustments: request.adjustments,
            backgroundFill: request.backgroundFill,
          }),
          width: digital.width,
          height: digital.height,
          // A digital upload is measured in pixels, but the file should still
          // declare a sane physical size for anyone who prints it.
          dpi: Math.round(
            digital.height / (request.format.height_mm / 25.4),
          ),
        }
      : renderForFormat(request.source, request.crop, request.format, {
          dpi: request.dpi,
          adjustments: request.adjustments,
          backgroundFill: request.backgroundFill,
        });

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
    const failure: EncodeResponse = {
      id: request.id,
      ok: false,
      code: "encode-failed",
      message:
        error instanceof Error
          ? error.message
          : "The photo could not be exported.",
      source: request.source,
    };
    // Hand the bitmap back even on failure, or the session loses its photo.
    ctx.postMessage(failure, [request.source]);
  }
});

export {};
