/**
 * MediaPipe FaceLandmarker wrapper.
 *
 * Everything is lazy: the WASM runtime (~3 MB) and the model (~3.7 MB) are only
 * fetched the first time a photo is actually processed, and cached by the
 * service worker afterwards. Intended to run inside a Web Worker.
 */

import type { Landmark, Size } from "../types";

export interface FaceLandmarkerConfig {
  /** Directory containing vision_wasm_internal.{js,wasm}. */
  wasmBaseUrl: string;
  /** URL of face_landmarker.task. */
  modelUrl: string;
  delegate?: "CPU" | "GPU";
}

export interface DetectedFace {
  landmarks: Landmark[];
  /** Normalized face bounding box, handy for the multi-face picker. */
  bounds: { x: number; y: number; width: number; height: number };
}

export interface DetectResult {
  faces: DetectedFace[];
  image: Size;
}

type MediapipeModule = typeof import("@mediapipe/tasks-vision");

let modulePromise: Promise<MediapipeModule> | null = null;
let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null;

interface FaceLandmarkerLike {
  detect(image: ImageBitmap | ImageData | HTMLCanvasElement): {
    faceLandmarks: Landmark[][];
  };
  close(): void;
}

async function loadModule(): Promise<MediapipeModule> {
  modulePromise ??= import("@mediapipe/tasks-vision");
  return modulePromise;
}

export async function getFaceLandmarker(
  config: FaceLandmarkerConfig,
): Promise<FaceLandmarkerLike> {
  landmarkerPromise ??= (async () => {
    const vision = await loadModule();
    const fileset = await vision.FilesetResolver.forVisionTasks(
      config.wasmBaseUrl,
    );
    const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: config.modelUrl,
        delegate: config.delegate ?? "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 5,
      // Iris landmarks (468–477) come from the refined model output and give a
      // much better eye line than the eyelid fallbacks.
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return landmarker as unknown as FaceLandmarkerLike;
  })();
  return landmarkerPromise;
}

/** Drop the cached instance — used by the worker's restart-on-error path. */
export function disposeFaceLandmarker(): void {
  const pending = landmarkerPromise;
  landmarkerPromise = null;
  void pending?.then((l) => l.close()).catch(() => undefined);
}

function boundsOf(landmarks: readonly Landmark[]) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export async function detectFaces(
  bitmap: ImageBitmap,
  config: FaceLandmarkerConfig,
): Promise<DetectResult> {
  const landmarker = await getFaceLandmarker(config);
  const result = landmarker.detect(bitmap);
  const faces = result.faceLandmarks.map((landmarks) => ({
    landmarks,
    bounds: boundsOf(landmarks),
  }));
  // Largest face first: the subject is almost always the biggest one.
  faces.sort((a, b) => b.bounds.height - a.bounds.height);
  return { faces, image: { width: bitmap.width, height: bitmap.height } };
}
