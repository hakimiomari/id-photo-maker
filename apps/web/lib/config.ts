import type { FaceLandmarkerConfig } from "@photomaker/core";

/**
 * Model asset locations. Defaults point at the public CDN so a fresh checkout
 * runs without a download step; `pnpm --filter @photomaker/web fetch:models`
 * pulls them into /public/models for self-hosting (required for the offline
 * PWA in Phase 2). Override with NEXT_PUBLIC_MEDIAPIPE_BASE / _MODEL.
 */
const CDN_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const CDN_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const faceLandmarkerConfig: FaceLandmarkerConfig = {
  wasmBaseUrl: process.env.NEXT_PUBLIC_MEDIAPIPE_BASE ?? CDN_WASM_BASE,
  modelUrl: process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL ?? CDN_MODEL,
  delegate: "GPU",
};
