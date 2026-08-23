/**
 * Head-pose and expression metrics from the face mesh (spec §4.6, compliance
 * pre-check). Pure geometry on landmarks — no pixels, no I/O — so it can run
 * synchronously on the main thread every time the selected face changes.
 *
 * Everything is measured in pixel space: MediaPipe's normalized coordinates are
 * relative to the image's width and height separately, so angles and aspect
 * ratios computed on them directly would be distorted by the image's aspect.
 */

import type { Landmark, PoseMetrics, Size } from "../types";
import { LM_CHIN, LM_IRIS_LEFT, LM_IRIS_RIGHT } from "../detect/headBounds";

/** Nose tip. */
export const LM_NOSE_TIP = 1;
/** Topmost point of the face mesh (forehead). */
export const LM_FOREHEAD = 10;
/** Inner lip centres: the gap between them is the mouth opening. */
export const LM_LIP_UPPER_INNER = 13;
export const LM_LIP_LOWER_INNER = 14;

/** Eye A: outer/inner corners plus upper/lower lid centres. */
export const LM_EYE_A = { outer: 33, inner: 133, upper: 159, lower: 145 };
/** Eye B: the mirror set. */
export const LM_EYE_B = { outer: 263, inner: 362, upper: 386, lower: 374 };

/**
 * A nose tip sits roughly this far from the head's rotation axis, in units of
 * the head's half-width. It converts nose-tip asymmetry into a yaw angle via
 * a sphere-plus-protrusion model: projected tip offset = k · sin(yaw).
 */
export const NOSE_PROTRUSION_K = 1.2;

const RAD_TO_DEG = 180 / Math.PI;

function at(landmarks: readonly Landmark[], index: number): Landmark {
  const lm = landmarks[index];
  if (!lm) throw new Error(`Missing landmark ${index} (got ${landmarks.length})`);
  return lm;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Eye aspect ratio: lid-to-lid opening over corner-to-corner width, in px.
 * ~0.25–0.40 for open eyes, below ~0.1 when closed.
 */
function eyeAspectRatio(
  landmarks: readonly Landmark[],
  eye: { outer: number; inner: number; upper: number; lower: number },
  image: Size,
): number {
  const w = Math.abs(at(landmarks, eye.outer).x - at(landmarks, eye.inner).x) * image.width;
  const h = Math.abs(at(landmarks, eye.upper).y - at(landmarks, eye.lower).y) * image.height;
  return w > 0 ? h / w : 0;
}

export interface PoseOptions {
  landmarks: readonly Landmark[];
  image: Size;
}

/**
 * Measure roll, yaw, eye openness and mouth opening. Throws on a mesh shorter
 * than the 468-point model, like estimateHeadBounds.
 */
export function measurePose(options: PoseOptions): PoseMetrics {
  const { landmarks, image } = options;
  if (landmarks.length < 468) {
    throw new Error(
      `measurePose: expected the 468/478-point face mesh, got ${landmarks.length}`,
    );
  }

  // Roll: the line through the two irises (or eye corners when iris landmarks
  // are missing). Ordered by x so the sign is viewer-relative: positive means
  // the eye on the image's right is lower.
  const hasIris = landmarks.length > LM_IRIS_RIGHT;
  const eyeA = at(landmarks, hasIris ? LM_IRIS_LEFT : LM_EYE_A.outer);
  const eyeB = at(landmarks, hasIris ? LM_IRIS_RIGHT : LM_EYE_B.outer);
  const [left, right] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];
  const dx = (right.x - left.x) * image.width;
  const dy = (right.y - left.y) * image.height;
  const rollDeg = dx > 0 ? Math.atan2(dy, dx) * RAD_TO_DEG : 0;

  // Yaw: where the nose tip sits between the two silhouette edges of the mesh.
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  for (const lm of landmarks) {
    if (lm.x < xMin) xMin = lm.x;
    if (lm.x > xMax) xMax = lm.x;
  }
  const nose = at(landmarks, LM_NOSE_TIP).x;
  const dLeft = nose - xMin;
  const dRight = xMax - nose;
  const span = dLeft + dRight;
  const asymmetry = span > 0 ? (dRight - dLeft) / span : 0;
  const yawDeg =
    Math.asin(clamp(asymmetry / NOSE_PROTRUSION_K, -1, 1)) * RAD_TO_DEG;

  const eyeOpenness = Math.min(
    eyeAspectRatio(landmarks, LM_EYE_A, image),
    eyeAspectRatio(landmarks, LM_EYE_B, image),
  );

  const faceHeight =
    (at(landmarks, LM_CHIN).y - at(landmarks, LM_FOREHEAD).y) * image.height;
  const lipGap =
    (at(landmarks, LM_LIP_LOWER_INNER).y - at(landmarks, LM_LIP_UPPER_INNER).y) *
    image.height;
  const mouthOpenRatio = faceHeight > 0 ? Math.max(0, lipGap) / faceHeight : 0;

  return { rollDeg, yawDeg, eyeOpenness, mouthOpenRatio };
}
