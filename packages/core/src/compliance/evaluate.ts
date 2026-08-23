/**
 * Compliance pre-check evaluator (spec §4.6).
 *
 * Takes the pose metrics (from landmarks) and the pixel metrics (from the
 * worker scan) and produces the "Photo quality" checklist: head pose,
 * expression, exposure, lighting, sharpness and background.
 *
 * Every item here is a heuristic against ICAO 9303 / typical national guidance,
 * so the report is deliberately capped at "warn". It can never block an export
 * the way the geometry checks do — a false positive must cost the user a
 * second look, not their photo. Thresholds live here and nowhere else.
 */

import type {
  BackgroundSpec,
  BackgroundStats,
  ComplianceReport,
  ImageMetrics,
  PhotoFormat,
  PoseMetrics,
  ValidationItem,
  ValidationLevel,
} from "../types";
import { BACKGROUND_FILLS } from "../render/pipeline";

/** Head tilt beyond this many degrees is flagged (ICAO allows ~8°). */
export const ROLL_WARN_DEG = 5;
/** Head turn beyond this many degrees is flagged. */
export const YAW_WARN_DEG = 8;
/** Eye aspect ratio below this reads as closed or squinting. */
export const EYE_OPEN_MIN = 0.13;
/** Inner-lip gap over face height above this reads as an open mouth. */
export const MOUTH_OPEN_MAX = 0.03;
/** Mean face luminance band (0–255). */
export const FACE_LUMA_MIN = 70;
export const FACE_LUMA_MAX = 200;
/** Fraction of clipped face pixels above which the face is overexposed. */
export const FACE_CLIP_MAX = 0.05;
/** Brighter half / darker half of the face above this is one-sided lighting. */
export const LIGHTING_RATIO_MAX = 1.35;
/** Laplacian-variance sharpness score below this is soft/blurred. */
export const SHARPNESS_MIN = 80;
/** Background luminance spread above this is not a plain backdrop. */
export const BACKGROUND_STD_MAX = 20;

export const BACKGROUND_LABELS: Record<BackgroundSpec, string> = {
  white: "white",
  off_white: "off-white",
  light_grey: "light grey",
  blue: "blue",
  red: "red",
  any: "plain",
};

function round0(n: number): number {
  return Math.round(n);
}

/** Does the measured background colour satisfy the format's spec? */
export function backgroundColourMatches(
  spec: BackgroundSpec,
  bg: BackgroundStats,
): boolean {
  switch (spec) {
    case "white":
      return bg.mean >= 200 && bg.chroma <= 30;
    case "off_white":
      return bg.mean >= 185 && bg.chroma <= 45;
    case "light_grey":
      return bg.mean >= 120 && bg.mean <= 225 && bg.chroma <= 30;
    case "blue":
      return bg.b > bg.r + 25 && bg.b > bg.g + 10;
    case "red":
      return bg.r > bg.g + 40 && bg.r > bg.b + 40;
    case "any":
      return true;
  }
}

export interface EvaluateOptions {
  pose: PoseMetrics | null;
  image: ImageMetrics | null;
  format: PhotoFormat;
  /** Active background replacement colour, or null when the original stays. */
  replacementFill: string | null;
}

function poseChecks(pose: PoseMetrics): ValidationItem[] {
  const items: ValidationItem[] = [];

  const roll = Math.abs(pose.rollDeg);
  items.push(
    roll > ROLL_WARN_DEG
      ? {
          id: "pose-roll",
          level: "warn",
          value: roll,
          message: `Head is tilted about ${round0(roll)}°`,
          hint: "Keep the head upright — the line through both eyes should be level.",
        }
      : { id: "pose-roll", level: "ok", value: roll, message: "Head is upright" },
  );

  const yaw = Math.abs(pose.yawDeg);
  items.push(
    yaw > YAW_WARN_DEG
      ? {
          id: "pose-yaw",
          level: "warn",
          value: yaw,
          message: `Head is turned about ${round0(yaw)}° to the side`,
          hint: "Face the camera directly, with both ears equally visible.",
        }
      : { id: "pose-yaw", level: "ok", value: yaw, message: "Facing the camera" },
  );

  items.push(
    pose.eyeOpenness < EYE_OPEN_MIN
      ? {
          id: "eyes-open",
          level: "warn",
          value: pose.eyeOpenness,
          message: "Eyes look closed or nearly closed",
          hint: "Both eyes must be open and clearly visible, looking at the camera.",
        }
      : {
          id: "eyes-open",
          level: "ok",
          value: pose.eyeOpenness,
          message: "Eyes open",
        },
  );

  items.push(
    pose.mouthOpenRatio > MOUTH_OPEN_MAX
      ? {
          id: "expression",
          level: "warn",
          value: pose.mouthOpenRatio,
          message: "Mouth is open",
          hint: "Keep a neutral expression with the mouth closed — most authorities reject smiles that show teeth.",
        }
      : {
          id: "expression",
          level: "ok",
          value: pose.mouthOpenRatio,
          message: "Mouth closed",
        },
  );

  return items;
}

function imageChecks(
  image: ImageMetrics,
  format: PhotoFormat,
  replacementFill: string | null,
): ValidationItem[] {
  const items: ValidationItem[] = [];
  const { face } = image;

  if (face.samples > 0) {
    if (face.mean < FACE_LUMA_MIN) {
      items.push({
        id: "exposure",
        level: "warn",
        value: face.mean,
        message: "Face is too dark",
        hint: "Use more light from the front, or raise brightness in Adjust.",
      });
    } else if (face.mean > FACE_LUMA_MAX || face.clipped > FACE_CLIP_MAX) {
      items.push({
        id: "exposure",
        level: "warn",
        value: face.mean,
        message: "Face is overexposed",
        hint: "Avoid direct flash and bright windows behind the camera; lower brightness in Adjust.",
      });
    } else {
      items.push({
        id: "exposure",
        level: "ok",
        value: face.mean,
        message: "Exposure looks good",
      });
    }

    const bright = Math.max(face.leftMean, face.rightMean);
    const dark = Math.min(face.leftMean, face.rightMean);
    const ratio = dark > 0 ? bright / dark : 1;
    items.push(
      ratio > LIGHTING_RATIO_MAX
        ? {
            id: "lighting",
            level: "warn",
            value: ratio,
            message: "Lighting is uneven — one side of the face is darker",
            hint: "Light the face evenly from the front; avoid a window or lamp to one side.",
          }
        : {
            id: "lighting",
            level: "ok",
            value: ratio,
            message: "Lighting is even",
          },
    );

    items.push(
      image.sharpness < SHARPNESS_MIN
        ? {
            id: "sharpness",
            level: "warn",
            value: image.sharpness,
            message: "Photo looks soft or blurred",
            hint: "Focus on the eyes, hold the camera steady, and use the original full-size photo rather than a screenshot.",
          }
        : {
            id: "sharpness",
            level: "ok",
            value: image.sharpness,
            message: "Photo is sharp",
          },
    );
  }

  const label = BACKGROUND_LABELS[format.background];
  if (replacementFill) {
    const required = BACKGROUND_FILLS[format.background];
    const matches =
      format.background === "any" ||
      !required ||
      required.toUpperCase() === replacementFill.toUpperCase();
    items.push(
      matches
        ? {
            id: "background",
            level: "ok",
            message:
              format.background === "any"
                ? "Background will be replaced with a plain colour"
                : `Background will be replaced with plain ${label}`,
          }
        : {
            id: "background",
            level: "warn",
            message: `Background should be ${label} — a different fill is selected`,
            hint: "Pick the required colour under Background before downloading.",
          },
    );
  } else if (image.background) {
    const bg = image.background;
    if (bg.std > BACKGROUND_STD_MAX) {
      items.push({
        id: "background",
        level: "warn",
        value: bg.std,
        message: "Background is not plain",
        hint: "Stand in front of a plain, evenly lit wall — or use Remove background below.",
      });
    } else if (!backgroundColourMatches(format.background, bg)) {
      items.push({
        id: "background",
        level: "warn",
        value: bg.mean,
        message: `Background should be ${label} — yours looks different`,
        hint: "Use Remove background below to replace it with the required colour.",
      });
    } else {
      items.push({
        id: "background",
        level: "ok",
        value: bg.std,
        message:
          format.background === "any"
            ? "Background is plain"
            : `Background is plain ${label}`,
      });
    }
  }

  return items;
}

/**
 * Build the pre-check report. Pose items appear as soon as landmarks exist;
 * pixel items appear once the worker scan has run (`image` non-null).
 */
export function evaluateCompliance(options: EvaluateOptions): ComplianceReport {
  const { pose, image, format, replacementFill } = options;
  const checks: ValidationItem[] = [];
  if (pose) checks.push(...poseChecks(pose));
  if (image) checks.push(...imageChecks(image, format, replacementFill));

  // Heuristics inform; they never block. Cap at warn regardless of item level.
  const level: ValidationLevel = checks.some((c) => c.level !== "ok")
    ? "warn"
    : "ok";

  return { level, checks, pose };
}
