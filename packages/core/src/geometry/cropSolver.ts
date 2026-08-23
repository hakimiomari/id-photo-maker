/**
 * The crop solver (spec §4).
 *
 * Given head geometry in working-px coordinates and a PhotoFormat, produce the
 * crop rectangle whose printed result satisfies the format's head-height,
 * top-margin and eye-line constraints — plus a validation report describing how
 * close the achieved geometry actually is.
 *
 * This module is pure: no DOM, no canvas, no I/O. It is the most heavily tested
 * file in the repo because a wrong number here gets a real application rejected.
 */

import type {
  CropAdjustments,
  CropSolution,
  HeadBox,
  PhotoFormat,
  Rect,
  Size,
  ValidationItem,
  ValidationLevel,
} from "../types";
import { clamp, effectiveDpi, midpoint } from "./units";

/**
 * Fraction of the photo height the head should occupy when a format does not
 * regulate it. 0.75 matches the common 3x4 / 2x3 guidance (30mm head on a 40mm
 * photo, 22.5mm on 30mm).
 */
export const DEFAULT_HEAD_HEIGHT_FRACTION = 0.75;

/**
 * Where the head sits vertically when the format specifies neither a top margin
 * nor an eye line: 42% of the leftover space goes above the crown, biasing the
 * subject upward as ID photos conventionally do.
 */
export const DEFAULT_CROWN_MARGIN_RATIO = 0.42;

/** Amber tolerance band outside a spec range, as a fraction of the target value. */
export const WARN_TOLERANCE = 0.05;

/** Below this effective DPI the export is unusable in print, not merely poor. */
export const HARD_MIN_DPI = 200;

/**
 * Face midline offset from the crop centre, as a fraction of crop width.
 * Beyond WARN the photo looks off-centre; beyond ERROR it is plainly not
 * centred and gets rejected.
 */
export const CENTRING_WARN_FRACTION = 0.05;
export const CENTRING_ERROR_FRACTION = 0.15;

const EPS = 1e-9;

export const IDENTITY_ADJUSTMENTS: CropAdjustments = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

export interface SolveOptions {
  head: HeadBox;
  format: PhotoFormat;
  /** Size of the coordinate space `head` is expressed in (the working copy). */
  image: Size;
  adjust?: CropAdjustments;
  /**
   * source px per working px. Used only to report effective print resolution;
   * defaults to 1 (i.e. the working copy is the source).
   */
  sourceScale?: number;
}

/** Target chin->crown height in mm for a format, honouring unregulated formats. */
export function targetHeadHeightMm(format: PhotoFormat): number {
  if (format.head_min_mm !== null && format.head_max_mm !== null) {
    return midpoint([format.head_min_mm, format.head_max_mm]);
  }
  if (format.head_min_mm !== null) return format.head_min_mm;
  if (format.head_max_mm !== null) return format.head_max_mm;
  return format.height_mm * DEFAULT_HEAD_HEIGHT_FRACTION;
}

export function headRange(format: PhotoFormat): [number, number] | null {
  if (format.head_min_mm === null || format.head_max_mm === null) return null;
  return [format.head_min_mm, format.head_max_mm];
}

function worst(levels: ValidationLevel[]): ValidationLevel {
  if (levels.includes("error")) return "error";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

/**
 * Classify a measured value against a required range with a ±WARN_TOLERANCE
 * amber band (tolerance is relative to the range midpoint).
 */
export function classifyRange(
  value: number,
  range: readonly [number, number],
): ValidationLevel {
  const [min, max] = range;
  if (value >= min - EPS && value <= max + EPS) return "ok";
  const tolerance = midpoint(range) * WARN_TOLERANCE;
  if (value >= min - tolerance - EPS && value <= max + tolerance + EPS) return "warn";
  return "error";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Vertical position of the crop's top edge, in working px, for a given scale.
 * Priority: explicit top margin > eye line > default crown-margin ratio.
 */
function solveCropTop(
  format: PhotoFormat,
  head: HeadBox,
  mmPerPx: number,
  headHeightMm: number,
): number {
  if (format.top_margin_mm) {
    return head.yCrown - midpoint(format.top_margin_mm) / mmPerPx;
  }
  if (format.eye_line_from_bottom_mm) {
    const eyeFromBottomMm = midpoint(format.eye_line_from_bottom_mm);
    const eyeFromTopMm = format.height_mm - eyeFromBottomMm;
    return head.yEyes - eyeFromTopMm / mmPerPx;
  }
  const crownMarginMm =
    (format.height_mm - headHeightMm) * DEFAULT_CROWN_MARGIN_RATIO;
  return head.yCrown - crownMarginMm / mmPerPx;
}

export function solveCrop(options: SolveOptions): CropSolution {
  const { head, format, image } = options;
  const adjust = options.adjust ?? IDENTITY_ADJUSTMENTS;
  const sourceScale = options.sourceScale ?? 1;

  const headPx = head.yChin - head.yCrown;
  if (!(headPx > 0)) {
    throw new Error(
      `solveCrop: invalid head bounds (yCrown=${head.yCrown}, yChin=${head.yChin})`,
    );
  }
  if (!(adjust.scale > 0)) {
    throw new Error(`solveCrop: scale must be > 0 (got ${adjust.scale})`);
  }

  const targetHeadMm = targetHeadHeightMm(format);

  // Zooming in (scale > 1) means fewer source pixels cover the photo, i.e. each
  // pixel is worth more millimetres.
  let mmPerPx = (targetHeadMm / headPx) * adjust.scale;
  let width = format.width_mm / mmPerPx;
  let height = format.height_mm / mmPerPx;
  let clamped = false;

  // The crop can never be larger than the image it comes from; shrink to fit and
  // recompute the scale so the reported millimetres stay truthful.
  if (width > image.width + EPS || height > image.height + EPS) {
    const fit = Math.min(image.width / width, image.height / height);
    width *= fit;
    height *= fit;
    mmPerPx = format.height_mm / height;
    clamped = true;
  }

  const headHeightMm = headPx * mmPerPx;

  let x = head.xMidline - width / 2 + adjust.offsetX;
  let y = solveCropTop(format, head, mmPerPx, headHeightMm) + adjust.offsetY;

  const maxX = Math.max(0, image.width - width);
  const maxY = Math.max(0, image.height - height);
  const clampedX = clamp(x, 0, maxX);
  const clampedY = clamp(y, 0, maxY);
  if (Math.abs(clampedX - x) > 1e-6 || Math.abs(clampedY - y) > 1e-6) {
    clamped = true;
  }
  x = clampedX;
  y = clampedY;

  const rect: Rect = { x, y, width, height };
  const topMarginMm = (head.yCrown - y) * mmPerPx;
  const eyeLineFromBottomMm = (y + height - head.yEyes) * mmPerPx;
  const centreOffsetFraction = (head.xMidline - (x + width / 2)) / width;

  const validations = buildValidations({
    format,
    headHeightMm,
    topMarginMm,
    eyeLineFromBottomMm,
    centreOffsetFraction,
    cropHeightSourcePx: height * sourceScale,
    clamped,
  });

  return {
    rect,
    mmPerPx,
    headHeightMm,
    topMarginMm,
    eyeLineFromBottomMm,
    clamped,
    level: worst(validations.map((v) => v.level)),
    validations,
  };
}

interface ValidationInput {
  format: PhotoFormat;
  headHeightMm: number;
  topMarginMm: number;
  eyeLineFromBottomMm: number;
  /** Signed midline offset from the crop centre, as a fraction of crop width. */
  centreOffsetFraction: number;
  cropHeightSourcePx: number;
  clamped: boolean;
}

function buildValidations(input: ValidationInput): ValidationItem[] {
  const {
    format,
    headHeightMm,
    topMarginMm,
    eyeLineFromBottomMm,
    centreOffsetFraction,
    cropHeightSourcePx,
    clamped,
  } = input;
  const items: ValidationItem[] = [];

  const range = headRange(format);
  if (range) {
    const level = classifyRange(headHeightMm, range);
    items.push({
      id: "head-height",
      level,
      value: headHeightMm,
      range,
      message:
        level === "ok"
          ? `Head height: ${round1(headHeightMm)} mm (required ${range[0]}–${range[1]} mm)`
          : `Head height: ${round1(headHeightMm)} mm — outside the required ${range[0]}–${range[1]} mm`,
    });
  } else {
    items.push({
      id: "head-height",
      level: "ok",
      value: headHeightMm,
      message: `Head height: ${round1(headHeightMm)} mm (no official requirement for this format)`,
    });
  }

  if (format.top_margin_mm) {
    const level = classifyRange(topMarginMm, format.top_margin_mm);
    items.push({
      id: "top-margin",
      level,
      value: topMarginMm,
      range: format.top_margin_mm,
      message: `Space above head: ${round1(topMarginMm)} mm (required ${format.top_margin_mm[0]}–${format.top_margin_mm[1]} mm)`,
    });
  }

  if (format.eye_line_from_bottom_mm) {
    const level = classifyRange(
      eyeLineFromBottomMm,
      format.eye_line_from_bottom_mm,
    );
    items.push({
      id: "eye-line",
      level,
      value: eyeLineFromBottomMm,
      range: format.eye_line_from_bottom_mm,
      message: `Eye line from bottom: ${round1(eyeLineFromBottomMm)} mm (required ${format.eye_line_from_bottom_mm[0]}–${format.eye_line_from_bottom_mm[1]} mm)`,
    });
  }

  const offCentre = Math.abs(centreOffsetFraction);
  const offCentreMm = offCentre * format.width_mm;
  // A clamped crop can be off-centre through no fault of the user (the face is
  // near the photo's edge); that is the framing-room warning's territory, so
  // only a deliberate drag off-centre escalates to an error.
  const centringLevel: ValidationLevel =
    offCentre > CENTRING_ERROR_FRACTION && !clamped
      ? "error"
      : offCentre > CENTRING_WARN_FRACTION
        ? "warn"
        : "ok";
  items.push({
    id: "centring",
    level: centringLevel,
    value: offCentreMm,
    message:
      centringLevel === "ok"
        ? "Face is centred"
        : `Face is ${round1(offCentreMm)} mm off-centre to the ${centreOffsetFraction > 0 ? "right" : "left"}`,
    ...(centringLevel === "ok"
      ? {}
      : { hint: "Drag the photo so the face sits in the middle of the frame, or reset the crop." }),
  });

  const dpi = effectiveDpi(cropHeightSourcePx, format.height_mm);
  const dpiLevel: ValidationLevel =
    dpi < HARD_MIN_DPI ? "error" : dpi < format.min_dpi ? "warn" : "ok";
  items.push({
    id: "resolution",
    level: dpiLevel,
    value: dpi,
    range: [format.min_dpi, format.target_dpi],
    message:
      dpiLevel === "ok"
        ? `Print resolution: ${Math.round(dpi)} DPI`
        : dpiLevel === "warn"
          ? `Print resolution: ${Math.round(dpi)} DPI — below the recommended ${format.min_dpi} DPI, print quality will suffer`
          : `Print resolution: ${Math.round(dpi)} DPI — too low to print. Use a higher-resolution photo.`,
  });

  if (clamped) {
    const headOutOfSpec =
      items.find((i) => i.id === "head-height")?.level === "error";
    items.push({
      id: "framing-room",
      level: headOutOfSpec ? "error" : "warn",
      message: headOutOfSpec
        ? "Photo doesn't have enough room around the head — retake with more space above the head and at the sides."
        : "The crop reaches the edge of the photo; a little more space around the head would be safer.",
    });
  }

  return items;
}

/** Map a working-px crop rect onto the original source image. */
export function toSourceRect(rect: Rect, sourceScale: number): Rect {
  return {
    x: rect.x * sourceScale,
    y: rect.y * sourceScale,
    width: rect.width * sourceScale,
    height: rect.height * sourceScale,
  };
}
