/**
 * Head bounds estimation (spec §4.2).
 *
 * MediaPipe gives a reliable chin (landmark 152) but no crown: the top of the
 * hair is not part of the face mesh. We estimate it from the mesh top plus a
 * hair allowance, and refine it from a segmentation mask when one is available
 * (Phase 3) — the mask-derived crown is far more accurate for tall hair.
 */

import type { HeadBox, Landmark, Size } from "../types";

/** Chin. */
export const LM_CHIN = 152;
/** Nose bridge — used as the face midline for horizontal centring. */
export const LM_NOSE_BRIDGE = 168;
/** Iris centres (present in the 478-landmark model). */
export const LM_IRIS_LEFT = 468;
export const LM_IRIS_RIGHT = 473;
/** Upper-eyelid fallbacks when iris landmarks are absent. */
export const LM_EYE_LEFT_FALLBACK = 159;
export const LM_EYE_RIGHT_FALLBACK = 386;

/** Forehead / upper skull outline; their minimum y is the top of the face mesh. */
export const LM_FOREHEAD_TOP = [10, 338, 297, 332, 284, 251, 21, 54, 103, 67, 109];

/**
 * Hair allowance: the crown sits this fraction of the mesh-top-to-chin distance
 * above the mesh top. 0.30 is the spec's baseline (§4.2.2).
 */
export const HAIR_ALLOWANCE_K = 0.3;

export interface HeadBoundsOptions {
  /** Landmarks in normalized (0..1) coordinates, as MediaPipe returns them. */
  landmarks: readonly Landmark[];
  /** Size of the coordinate space to produce (the working copy). */
  image: Size;
  hairAllowance?: number;
}

function at(landmarks: readonly Landmark[], index: number): Landmark {
  const lm = landmarks[index];
  if (!lm) throw new Error(`Missing landmark ${index} (got ${landmarks.length})`);
  return lm;
}

export function estimateHeadBounds(options: HeadBoundsOptions): HeadBox {
  const { landmarks, image } = options;
  const k = options.hairAllowance ?? HAIR_ALLOWANCE_K;

  if (landmarks.length < 468) {
    throw new Error(
      `estimateHeadBounds: expected the 468/478-point face mesh, got ${landmarks.length}`,
    );
  }

  const toPxY = (n: number) => n * image.height;
  const toPxX = (n: number) => n * image.width;

  const yChin = toPxY(at(landmarks, LM_CHIN).y);

  let meshTopNorm = Number.POSITIVE_INFINITY;
  for (const index of LM_FOREHEAD_TOP) {
    meshTopNorm = Math.min(meshTopNorm, at(landmarks, index).y);
  }
  const yMeshTop = toPxY(meshTopNorm);

  // Hair allowance scales with face size, so it holds at any distance.
  const yCrown = yMeshTop - k * (yChin - yMeshTop);

  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  for (const lm of landmarks) {
    if (lm.x < xMin) xMin = lm.x;
    if (lm.x > xMax) xMax = lm.x;
  }

  const hasIris = landmarks.length > LM_IRIS_RIGHT;
  const eyeA = at(landmarks, hasIris ? LM_IRIS_LEFT : LM_EYE_LEFT_FALLBACK);
  const eyeB = at(landmarks, hasIris ? LM_IRIS_RIGHT : LM_EYE_RIGHT_FALLBACK);

  return {
    yCrown,
    yChin,
    xLeft: toPxX(xMin),
    xRight: toPxX(xMax),
    yEyes: toPxY((eyeA.y + eyeB.y) / 2),
    xMidline: toPxX(at(landmarks, LM_NOSE_BRIDGE).x),
    crownSource: "heuristic",
  };
}

/**
 * Refine the crown using a foreground alpha mask (Phase 3): the topmost
 * foreground pixel within the horizontal span of the face. Falls back to the
 * heuristic crown if the mask has no foreground in that span, and never accepts
 * a crown below the mesh top (that would mean the mask clipped the head).
 *
 * @param mask   Alpha values 0..255, row-major, `maskSize` dimensions.
 */
export function refineCrownFromMask(
  head: HeadBox,
  mask: Uint8Array | Uint8ClampedArray,
  maskSize: Size,
  imageSize: Size,
  threshold = 128,
): HeadBox {
  const scaleX = maskSize.width / imageSize.width;
  const scaleY = maskSize.height / imageSize.height;

  // Widen slightly: hair is usually broader than the face mesh.
  const spanPad = (head.xRight - head.xLeft) * 0.1;
  const x0 = Math.max(0, Math.floor((head.xLeft - spanPad) * scaleX));
  const x1 = Math.min(
    maskSize.width - 1,
    Math.ceil((head.xRight + spanPad) * scaleX),
  );
  const yLimit = Math.min(maskSize.height - 1, Math.ceil(head.yChin * scaleY));

  for (let y = 0; y <= yLimit; y++) {
    const row = y * maskSize.width;
    for (let x = x0; x <= x1; x++) {
      if ((mask[row + x] ?? 0) >= threshold) {
        const yCrown = y / scaleY;
        // Guard against a mask that starts below the forehead.
        if (yCrown >= head.yChin) return head;
        return { ...head, yCrown, crownSource: "mask" };
      }
    }
  }
  return head;
}
