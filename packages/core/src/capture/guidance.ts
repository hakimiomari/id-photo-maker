/**
 * Live camera guidance (spec §4.7, camera capture).
 *
 * Given the head box and pose measured on a live video frame, decide what the
 * user should do next — move closer, back, straighten up — and where the crop
 * for the chosen format would land. Pure, so the camera UI stays a thin layer
 * over tested logic, and so the same rules apply whether the frame is a phone
 * selfie or a laptop webcam.
 */

import {
  DEFAULT_CROWN_MARGIN_RATIO,
  solveCrop,
  targetHeadHeightMm,
} from "../geometry/cropSolver";
import {
  EYE_OPEN_MIN,
  MOUTH_OPEN_MAX,
  ROLL_WARN_DEG,
  YAW_WARN_DEG,
} from "../compliance/evaluate";
import type { HeadBox, PhotoFormat, PoseMetrics, Rect, Size } from "../types";

/**
 * The crop should use about this much of the frame's height: enough pixels
 * for print, with room left so the solver never has to clamp.
 */
export const CAPTURE_FILL = 0.8;
/** Head smaller than this × ideal → "move closer"; larger than the max → "move back". */
export const HEAD_TOO_SMALL = 0.75;
export const HEAD_TOO_LARGE = 1.15;

export type GuidanceStatus = "no-face" | "adjust" | "good";

export type GuidanceCode =
  | "no-face"
  | "closer"
  | "back"
  | "centre"
  | "space-above"
  | "move-up"
  | "straighten"
  | "face-camera"
  | "open-eyes"
  | "close-mouth"
  | "good";

export interface CaptureGuidance {
  status: GuidanceStatus;
  code: GuidanceCode;
  /** Crop the solver would choose on this frame, in frame px; null without a face. */
  rect: Rect | null;
  /** Head height as a fraction of the frame height (0 without a face). */
  headFraction: number;
  /** The head fraction the guidance is steering towards. */
  idealHeadFraction: number;
}

export interface GuidanceOptions {
  head: HeadBox | null;
  pose: PoseMetrics | null;
  format: PhotoFormat;
  /** Size of the frame the head/pose were measured on. */
  frame: Size;
}

/**
 * Ideal chin-to-crown height as a fraction of the frame height: the format's
 * target head fraction, scaled to a crop that fills CAPTURE_FILL of the frame.
 * On a landscape frame the crop is height-bound, so height is the reference.
 */
export function idealHeadFraction(format: PhotoFormat, frame: Size): number {
  const headOfCrop = targetHeadHeightMm(format) / format.height_mm;
  // A portrait frame narrower than the crop's aspect is width-bound instead.
  const cropAspect = format.width_mm / format.height_mm;
  const maxCropHeight = Math.min(
    frame.height * CAPTURE_FILL,
    (frame.width * CAPTURE_FILL) / cropAspect,
  );
  return (headOfCrop * maxCropHeight) / frame.height;
}

export function assessFrame(options: GuidanceOptions): CaptureGuidance {
  const { head, pose, format, frame } = options;
  const ideal = idealHeadFraction(format, frame);

  if (!head || !(head.yChin > head.yCrown)) {
    return {
      status: "no-face",
      code: "no-face",
      rect: null,
      headFraction: 0,
      idealHeadFraction: ideal,
    };
  }

  const headFraction = (head.yChin - head.yCrown) / frame.height;
  const solution = solveCrop({ head, format, image: frame });
  const base = { rect: solution.rect, headFraction, idealHeadFraction: ideal };
  const adjust = (code: GuidanceCode): CaptureGuidance => ({
    status: "adjust",
    code,
    ...base,
  });

  // Distance first: everything else is easier to judge at the right size.
  if (headFraction < ideal * HEAD_TOO_SMALL) return adjust("closer");
  if (headFraction > ideal * HEAD_TOO_LARGE) return adjust("back");

  // Framing: a clamped crop means the photo would be cut off somewhere.
  if (solution.clamped) {
    const { rect } = solution;
    const eps = 0.5;
    if (rect.y <= eps) return adjust("space-above");
    if (rect.y + rect.height >= frame.height - eps) return adjust("move-up");
    if (rect.x <= eps || rect.x + rect.width >= frame.width - eps) {
      return adjust("centre");
    }
    return adjust("back");
  }

  if (pose) {
    if (Math.abs(pose.rollDeg) > ROLL_WARN_DEG) return adjust("straighten");
    if (Math.abs(pose.yawDeg) > YAW_WARN_DEG) return adjust("face-camera");
    if (pose.eyeOpenness < EYE_OPEN_MIN) return adjust("open-eyes");
    if (pose.mouthOpenRatio > MOUTH_OPEN_MAX) return adjust("close-mouth");
  }

  return { status: "good", code: "good", ...base };
}

/**
 * Static alignment guide for the preview before a face is found: the crop
 * frame centred in the view and the oval where the head should sit.
 */
export interface AlignmentGuide {
  crop: Rect;
  /** Head oval bounds: crown at the top, chin at the bottom. */
  head: Rect;
}

export function alignmentGuide(format: PhotoFormat, frame: Size): AlignmentGuide {
  const cropAspect = format.width_mm / format.height_mm;
  const height = Math.min(
    frame.height * CAPTURE_FILL,
    (frame.width * CAPTURE_FILL) / cropAspect,
  );
  const width = height * cropAspect;
  const x = (frame.width - width) / 2;
  const y = (frame.height - height) / 2;

  const headHeight = (targetHeadHeightMm(format) / format.height_mm) * height;
  const topMargin = format.top_margin_mm
    ? ((format.top_margin_mm[0] + format.top_margin_mm[1]) / 2 / format.height_mm) * height
    : (height - headHeight) * DEFAULT_CROWN_MARGIN_RATIO;
  // Faces are roughly 0.72× as wide as they are tall, crown to chin.
  const headWidth = headHeight * 0.72;

  return {
    crop: { x, y, width, height },
    head: {
      x: x + (width - headWidth) / 2,
      y: y + topMargin,
      width: headWidth,
      height: headHeight,
    },
  };
}
