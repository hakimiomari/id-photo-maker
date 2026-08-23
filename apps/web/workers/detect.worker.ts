/// <reference lib="webworker" />
/**
 * Decode + downscale + face detection. Runs entirely off the main thread; the
 * only things that come back are bitmaps and landmark coordinates — nothing
 * leaves the device.
 */

import {
  decodeImage,
  detectFaces,
  disposeFaceLandmarker,
  IngestError,
  makeWorkingCopy,
} from "@photomaker/core";
import type { DetectRequest, DetectResponse } from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", async (event: MessageEvent<DetectRequest>) => {
  const request = event.data;

  // Live camera frames: landmarks only. The bitmap is consumed here.
  if (request?.type === "frame") {
    const { bitmap } = request;
    try {
      const { faces } = await detectFaces(bitmap, request.config);
      const response: DetectResponse = {
        id: request.id,
        ok: true,
        kind: "frame",
        faces,
        size: { width: bitmap.width, height: bitmap.height },
      };
      ctx.postMessage(response);
    } catch (error) {
      disposeFaceLandmarker();
      const failure: DetectResponse = {
        id: request.id,
        ok: false,
        code: "detect-failed",
        message: error instanceof Error ? error.message : "Face detection failed.",
      };
      ctx.postMessage(failure);
    } finally {
      bitmap.close();
    }
    return;
  }

  if (request?.type !== "process") return;

  try {
    const decoded = await decodeImage(request.file);
    const working = await makeWorkingCopy(decoded.bitmap);

    // The preview and the export must own *separate* bitmaps. When the photo is
    // already within the working size, makeWorkingCopy hands back the source
    // itself — and exporting transfers the source into the encode worker, which
    // detaches it. A shared bitmap means the first export kills the preview.
    const workingBitmap =
      working.bitmap === decoded.bitmap
        ? await createImageBitmap(decoded.bitmap)
        : working.bitmap;

    const { faces } = await detectFaces(workingBitmap, request.config);

    const response: DetectResponse = {
      id: request.id,
      ok: true,
      working: workingBitmap,
      workingSize: working.size,
      sourceSize: { width: decoded.width, height: decoded.height },
      sourceScale: working.sourceScale,
      faces,
      source: decoded.bitmap,
    };

    ctx.postMessage(response, [workingBitmap, decoded.bitmap]);
  } catch (error) {
    // A failed detection can leave the WASM instance in a bad state; drop it so
    // the next attempt starts clean.
    if (!(error instanceof IngestError)) disposeFaceLandmarker();
    const failure: DetectResponse = {
      id: request.id,
      ok: false,
      code: error instanceof IngestError ? error.code : "detect-failed",
      message:
        error instanceof Error
          ? error.message
          : "Something went wrong while reading that photo.",
    };
    ctx.postMessage(failure);
  }
});

export {};
