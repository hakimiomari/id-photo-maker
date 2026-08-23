/// <reference lib="webworker" />
/**
 * Compliance pre-check worker (spec §4.6): exposure, lighting balance,
 * sharpness and background measurements over the working copy. Pure pixel
 * maths in @photomaker/core; this file only moves a bitmap into an ImageData
 * and back out as numbers. Nothing leaves the device.
 */

import { createCanvas, get2d, measureImage, releaseCanvas } from "@photomaker/core";
import type { PrecheckRequest, PrecheckResponse } from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<PrecheckRequest>) => {
  const request = event.data;
  if (request?.type !== "precheck") return;
  const { bitmap } = request;

  try {
    const started = performance.now();
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const canvasCtx = get2d(canvas, { willReadFrequently: true });
    canvasCtx.drawImage(bitmap, 0, 0);
    const pixels = canvasCtx.getImageData(0, 0, bitmap.width, bitmap.height);
    releaseCanvas(canvas);

    const metrics = measureImage(pixels, {
      face: request.face,
      head: request.head,
      rect: request.rect,
      mask: request.mask ?? null,
      maskSize: request.maskSize ?? null,
    });

    const response: PrecheckResponse = {
      id: request.id,
      ok: true,
      metrics,
      ms: Math.round(performance.now() - started),
    };
    ctx.postMessage(response);
  } catch (error) {
    const failure: PrecheckResponse = {
      id: request.id,
      ok: false,
      code: "precheck-failed",
      message:
        error instanceof Error
          ? error.message
          : "Could not analyse the photo quality.",
    };
    ctx.postMessage(failure);
  } finally {
    bitmap.close();
  }
});

export {};
