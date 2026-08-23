/**
 * Pixel-level measurements for the compliance pre-check: exposure, lighting
 * balance, sharpness and background uniformity/colour. Pure typed-array maths
 * on an RGBA buffer, so it runs in a worker without any DOM.
 *
 * The numbers here are *measurements only*. Turning them into verdicts is the
 * evaluator's job (evaluate.ts), which keeps thresholds in one place and lets
 * the format (and the background-replacement state) change without having to
 * re-scan the pixels.
 */

import type {
  BackgroundStats,
  FaceStats,
  HeadBox,
  ImageMetrics,
  Rect,
  Size,
} from "../types";

/** RGBA pixel buffer, e.g. an ImageData or a worker-side copy of one. */
export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/**
 * The face region is resampled to this many rows before measuring sharpness,
 * so the score does not depend on how many pixels the face happens to cover.
 * Calibrated on the bundled sample (a crisp portrait scores ~2000 here; a 2 px
 * gaussian blur at a 260 px face drops it below 60).
 */
export const SHARPNESS_ROWS = 200;

/** Hard ceiling on samples per region; larger regions are strided. */
const MAX_SAMPLES = 250_000;

/** Mask alpha below which a pixel counts as background. */
const BACKGROUND_ALPHA = 64;

/** Luminance clipping threshold (0–255). */
const CLIP_LUMA = 250;

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Integer pixel bounds of a (possibly fractional) rect, clipped to the image. */
function clipRect(rect: Rect, image: Size) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(image.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(image.height, Math.ceil(rect.y + rect.height));
  return { x0, y0, x1, y1, empty: x1 <= x0 || y1 <= y0 };
}

function strideFor(area: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(area / MAX_SAMPLES)));
}

/**
 * Mean / spread / clipping of the face, plus the left-half vs right-half means
 * that reveal one-sided lighting.
 */
export function measureFace(pixels: PixelSource, face: Rect): FaceStats {
  const { data, width } = pixels;
  const { x0, y0, x1, y1, empty } = clipRect(face, pixels);
  if (empty) {
    return { mean: 0, std: 0, clipped: 0, leftMean: 0, rightMean: 0, samples: 0 };
  }

  const stride = strideFor((x1 - x0) * (y1 - y0));
  const xMid = (x0 + x1) / 2;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let clipped = 0;
  let leftSum = 0;
  let leftN = 0;
  let rightSum = 0;
  let rightN = 0;

  for (let y = y0; y < y1; y += stride) {
    const row = y * width;
    for (let x = x0; x < x1; x += stride) {
      const i = (row + x) * 4;
      const L = luma(data[i]!, data[i + 1]!, data[i + 2]!);
      sum += L;
      sumSq += L * L;
      n++;
      if (L >= CLIP_LUMA) clipped++;
      if (x < xMid) {
        leftSum += L;
        leftN++;
      } else {
        rightSum += L;
        rightN++;
      }
    }
  }

  const mean = sum / n;
  return {
    mean,
    std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    clipped: clipped / n,
    leftMean: leftN ? leftSum / leftN : mean,
    rightMean: rightN ? rightSum / rightN : mean,
    samples: n,
  };
}

/**
 * Variance of the Laplacian over the face, resampled to SHARPNESS_ROWS rows.
 * High for crisp detail, near zero for blur. Noise inflates it, which is the
 * accepted limitation of this estimator — it errs towards "sharp".
 */
export function measureSharpness(pixels: PixelSource, face: Rect): number {
  const { data, width } = pixels;
  const { x0, y0, x1, y1, empty } = clipRect(face, pixels);
  if (empty) return 0;

  const regionW = x1 - x0;
  const regionH = y1 - y0;
  const step = Math.max(1, regionH / SHARPNESS_ROWS);
  const cols = Math.floor(regionW / step);
  const rows = Math.floor(regionH / step);
  if (cols < 3 || rows < 3) return 0;

  const grey = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y = Math.min(y1 - 1, Math.round(y0 + r * step));
    const row = y * width;
    for (let c = 0; c < cols; c++) {
      const x = Math.min(x1 - 1, Math.round(x0 + c * step));
      const i = (row + x) * 4;
      grey[r * cols + c] = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    }
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      const v =
        4 * grey[i]! - grey[i - 1]! - grey[i + 1]! - grey[i - cols]! - grey[i + cols]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

export interface BackgroundOptions {
  /** Crop rectangle; only background inside it matters. */
  rect: Rect;
  head: HeadBox;
  /** Portrait matte: background = alpha below 64. Far more accurate than the geometric fallback. */
  mask?: Uint8Array | Uint8ClampedArray | null;
  maskSize?: Size | null;
}

/**
 * Colour and uniformity of the background inside the crop. With a matte, the
 * background is whatever the matte says it is; without one, it is the band
 * above the crown plus the strips either side of the head, down to the chin —
 * shoulders and hair are excluded by construction. Returns null when no
 * background pixel could be sampled (e.g. a tight head-only crop).
 */
export function measureBackground(
  pixels: PixelSource,
  options: BackgroundOptions,
): BackgroundStats | null {
  const { data, width } = pixels;
  const { head, mask, maskSize } = options;
  const { x0, y0, x1, y1, empty } = clipRect(options.rect, pixels);
  if (empty) return null;

  const useMask = !!mask && !!maskSize;
  const maskScaleX = useMask ? maskSize.width / pixels.width : 1;
  const maskScaleY = useMask ? maskSize.height / pixels.height : 1;

  // Geometric fallback: pad the head span for hair and ears, and stop a little
  // above the heuristic crown in case it sits low.
  const headWidth = head.xRight - head.xLeft;
  const headHeight = head.yChin - head.yCrown;
  const padX = headWidth * 0.25;
  const spanLeft = head.xLeft - padX;
  const spanRight = head.xRight + padX;
  const crownLimit = head.yCrown - headHeight * 0.05;
  const chinLimit = head.yChin;

  const stride = strideFor((x1 - x0) * (y1 - y0));
  let sum = 0;
  let sumSq = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let chroma = 0;
  let n = 0;

  for (let y = y0; y < y1; y += stride) {
    const row = y * width;
    const maskRow = useMask ? Math.min(maskSize.height - 1, Math.floor(y * maskScaleY)) * maskSize.width : 0;
    for (let x = x0; x < x1; x += stride) {
      let isBackground: boolean;
      if (useMask) {
        const mx = Math.min(maskSize.width - 1, Math.floor(x * maskScaleX));
        isBackground = (mask[maskRow + mx] ?? 255) < BACKGROUND_ALPHA;
      } else if (y < crownLimit) {
        isBackground = true;
      } else if (y < chinLimit) {
        isBackground = x < spanLeft || x > spanRight;
      } else {
        isBackground = false;
      }
      if (!isBackground) continue;

      const i = (row + x) * 4;
      const R = data[i]!;
      const G = data[i + 1]!;
      const B = data[i + 2]!;
      const L = luma(R, G, B);
      sum += L;
      sumSq += L * L;
      r += R;
      g += G;
      b += B;
      chroma += Math.max(R, G, B) - Math.min(R, G, B);
      n++;
    }
  }

  if (n === 0) return null;
  const mean = sum / n;
  return {
    mean,
    std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    chroma: chroma / n,
    r: r / n,
    g: g / n,
    b: b / n,
    samples: n,
  };
}

export interface MeasureOptions extends BackgroundOptions {
  /** Bounding box of the face mesh, in px. */
  face: Rect;
}

/** All pixel measurements for one face in one pass-set. */
export function measureImage(
  pixels: PixelSource,
  options: MeasureOptions,
): ImageMetrics {
  return {
    face: measureFace(pixels, options.face),
    sharpness: measureSharpness(pixels, options.face),
    background: measureBackground(pixels, options),
    hasMask: !!options.mask && !!options.maskSize,
  };
}
