/// <reference lib="webworker" />
/**
 * Portrait matting worker (spec §5.3): MODNet via onnxruntime-web.
 * Prefers the WebGPU execution provider, falls back to WASM (SIMD). Model and
 * ORT wasm binaries are self-hosted (see scripts/fetch-models.mjs) — nothing
 * loads from a CDN, and no image data ever leaves the worker.
 */

import * as ort from "onnxruntime-web";
import {
  bilinearResizeAlpha,
  createCanvas,
  get2d,
  inferenceSize,
  matteToAlpha,
  releaseCanvas,
  toModNetInput,
} from "@photomaker/core";
import type { SegmentRequest, SegmentResponse } from "../lib/messages";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let sessionPromise: Promise<{
  session: ort.InferenceSession;
  backend: "webgpu" | "wasm";
}> | null = null;

async function getSession(config: SegmentRequest["config"]) {
  sessionPromise ??= (async () => {
    ort.env.wasm.wasmPaths = config.ortBase;
    // No COOP/COEP headers → no SharedArrayBuffer → keep it single-threaded
    // instead of letting ORT warn and fall back noisily.
    ort.env.wasm.numThreads = 1;

    // WebGPU when the hardware offers it (§5.3); WASM SIMD otherwise.
    try {
      const session = await ort.InferenceSession.create(config.modelUrl, {
        executionProviders: ["webgpu"],
      });
      return { session, backend: "webgpu" as const };
    } catch {
      const session = await ort.InferenceSession.create(config.modelUrl, {
        executionProviders: ["wasm"],
      });
      return { session, backend: "wasm" as const };
    }
  })();
  return sessionPromise;
}

ctx.addEventListener("message", async (event: MessageEvent<SegmentRequest>) => {
  const request = event.data;
  if (request?.type !== "segment") return;
  const { bitmap } = request;

  try {
    const started = performance.now();
    const { session, backend } = await getSession(request.config);

    // Downscale to the model's working resolution (long edge 512, /32).
    const target = inferenceSize({ width: bitmap.width, height: bitmap.height });
    const canvas = createCanvas(target.width, target.height);
    const canvasCtx = get2d(canvas, { willReadFrequently: true });
    canvasCtx.drawImage(bitmap, 0, 0, target.width, target.height);
    const rgba = canvasCtx.getImageData(0, 0, target.width, target.height);
    releaseCanvas(canvas);

    const input = new ort.Tensor("float32", toModNetInput(rgba.data, target), [
      1,
      3,
      target.height,
      target.width,
    ]);

    const inputName = session.inputNames[0] ?? "input";
    const outputName = session.outputNames[0] ?? "output";
    const results = await session.run({ [inputName]: input });
    const matte = results[outputName];
    if (!matte) throw new Error("Model returned no matte output");

    const alpha = matteToAlpha(matte.data as Float32Array);
    // Upsample to the working copy's resolution for preview + crown refinement.
    const mask = bilinearResizeAlpha(alpha, target, {
      width: bitmap.width,
      height: bitmap.height,
    });

    const response: SegmentResponse = {
      id: request.id,
      ok: true,
      mask,
      width: bitmap.width,
      height: bitmap.height,
      backend,
      ms: Math.round(performance.now() - started),
    };
    ctx.postMessage(response, [mask.buffer]);
  } catch (error) {
    // A failed session may be wedged (e.g. lost WebGPU device) — rebuild next time.
    sessionPromise = null;
    const failure: SegmentResponse = {
      id: request.id,
      ok: false,
      code: "segment-failed",
      message:
        error instanceof Error
          ? error.message
          : "Background removal failed. Please try again.",
    };
    ctx.postMessage(failure);
  } finally {
    bitmap.close();
  }
});

export {};
