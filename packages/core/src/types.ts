/**
 * Shared types for @photomaker/core.
 *
 * Coordinate conventions used throughout the package:
 *  - "working px"  — pixels of the downscaled working copy (<= 2048px long edge)
 *                    that detection and the editor operate on.
 *  - "source px"   — pixels of the original decoded image; export renders from these.
 *  - All physical dimensions are millimetres. Never inches internally.
 */

export type FormatCategory = "passport" | "visa" | "license" | "generic" | "other";

export type BackgroundSpec =
  | "white"
  | "light_grey"
  | "off_white"
  | "any"
  | "blue"
  | "red";

export interface DigitalSpec {
  width_px: number;
  height_px: number;
  max_bytes: number;
  format: "jpeg" | "png";
}

export interface PhotoFormat {
  id: string;
  label: Record<string, string>;
  category: FormatCategory;
  /** ISO 3166-1 alpha-2, empty for generic formats. */
  countries: string[];
  width_mm: number;
  height_mm: number;
  /** Chin -> crown height range. null when the spec does not regulate it. */
  head_min_mm: number | null;
  head_max_mm: number | null;
  /** Some specs constrain the eye line instead of / in addition to head height. */
  eye_line_from_bottom_mm?: [number, number];
  /** Crown-to-top-edge range if the spec gives one. */
  top_margin_mm?: [number, number];
  min_dpi: number;
  target_dpi: number;
  background: BackgroundSpec;
  digital_spec?: DigitalSpec;
  source_url: string;
  /** ISO date the spec was last checked against source_url. */
  verified_date: string;
  /**
   * "seeded" = transcribed but not yet re-read against source_url by a human.
   * The UI must show a stronger disclaimer for these; flipping to "verified" is
   * a manual, deliberate act (spec §12).
   */
  verification_status: "seeded" | "verified";
  notes?: string;
}

/** A single normalized MediaPipe landmark (0..1 relative to the detected image). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Head geometry in working-px coordinates.
 * `crownSource` records how the crown was obtained, because mask-derived crowns
 * are materially more accurate than the hair-allowance heuristic (§4.2).
 */
export interface HeadBox {
  yCrown: number;
  yChin: number;
  xLeft: number;
  xRight: number;
  /** Midpoint of the two iris centres (or eye corners as fallback). */
  yEyes: number;
  /** Face midline x (nose bridge), used for horizontal centring. */
  xMidline: number;
  crownSource: "heuristic" | "mask";
}

export interface CropAdjustments {
  /** Pan in working px. Positive x moves the crop window right. */
  offsetX: number;
  offsetY: number;
  /** Zoom multiplier applied to the auto-solved framing. >1 = subject appears larger. */
  scale: number;
}

export type ValidationLevel = "ok" | "warn" | "error";

export interface ValidationItem {
  id: string;
  level: ValidationLevel;
  message: string;
  /** Measured value in mm (or DPI, for resolution checks). */
  value?: number;
  range?: [number, number];
}

export interface CropSolution {
  /** Crop rectangle in working-px coordinates. May be fractional. */
  rect: Rect;
  /** Millimetres per working px inside this crop. */
  mmPerPx: number;
  /** Achieved chin->crown height in mm. */
  headHeightMm: number;
  /** Achieved crown-to-top-edge distance in mm. */
  topMarginMm: number;
  /** Achieved eye line measured from the bottom edge, in mm. */
  eyeLineFromBottomMm: number;
  /** True when the ideal rect had to be shrunk or moved to stay inside the image. */
  clamped: boolean;
  level: ValidationLevel;
  validations: ValidationItem[];
}
