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
  if (request?.type !== "process") return;

  try {
    const decoded = await decodeImage(request.file);
    const working = await makeWorkingCopy(decoded.bitmap);
    const { faces } = await detectFaces(working.bitmap, request.config);

    const sameBitmap = working.bitmap === decoded.bitmap;
    const response: DetectResponse = {
      id: request.id,
      ok: true,
      working: working.bitmap,
      workingSize: working.size,
      sourceSize: { width: decoded.width, height: decoded.height },
      sourceScale: working.sourceScale,
      faces,
      ...(sameBitmap ? {} : { source: decoded.bitmap }),
    };

    const transfer: Transferable[] = sameBitmap
      ? [working.bitmap]
      : [working.bitmap, decoded.bitmap];
    ctx.postMessage(response, transfer);
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
