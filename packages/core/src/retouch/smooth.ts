/**
 * Masked skin smoothing: a gaussian-approximated blur blended into the image
 * only where the user painted, scaled by their strength setting. The blur is
 * three box passes (a close gaussian approximation), computed over the mask's
 * bounding box only.
 */

import type { Size } from "../types";

function boxBlurPass(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean,
): void {
  const r = Math.max(1, Math.round(radius));
  const norm = 1 / (2 * r + 1);
  for (let a = 0; a < (horizontal ? h : w); a++) {
    for (let b = 0; b < (horizontal ? w : h); b++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const bb = Math.min((horizontal ? w : h) - 1, Math.max(0, b + k));
        const idx = horizontal ? a * w + bb : bb * w + a;
        sum += src[idx] as number;
      }
      const idx = horizontal ? a * w + b : b * w + a;
      dst[idx] = sum * norm;
    }
  }
}

/**
 * Blend a blurred copy into `data` wherever `mask` is set.
 * @param strength 0–1; capped by callers to keep results natural.
 */
export function applySmoothing(
  data: Uint8ClampedArray,
  size: Size,
  mask: Uint8Array,
  radius: number,
  strength: number,
): void {
  const { width, height } = size;

  // Bounding box of the painted mask, expanded by the blur radius.
  let mx0 = width;
  let my0 = height;
  let mx1 = -1;
  let my1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((mask[y * width + x] as number) > 0) {
        if (x < mx0) mx0 = x;
        if (x > mx1) mx1 = x;
        if (y < my0) my0 = y;
        if (y > my1) my1 = y;
      }
    }
  }
  if (mx1 < 0) return;

  const pad = Math.ceil(radius * 3);
  mx0 = Math.max(0, mx0 - pad);
  my0 = Math.max(0, my0 - pad);
  mx1 = Math.min(width - 1, mx1 + pad);
  my1 = Math.min(height - 1, my1 + pad);
  const bw = mx1 - mx0 + 1;
  const bh = my1 - my0 + 1;

  const channel = new Float32Array(bw * bh);
  const scratch = new Float32Array(bw * bh);

  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        channel[y * bw + x] = data[((my0 + y) * width + (mx0 + x)) * 4 + c] as number;
      }
    }
    // Three box passes ≈ gaussian.
    boxBlurPass(channel, scratch, bw, bh, radius, true);
    boxBlurPass(scratch, channel, bw, bh, radius, false);
    boxBlurPass(channel, scratch, bw, bh, radius, true);
    boxBlurPass(scratch, channel, bw, bh, radius, false);

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const gi = (my0 + y) * width + (mx0 + x);
        const m = ((mask[gi] as number) / 255) * strength;
        if (m === 0) continue;
        const o = gi * 4 + c;
        data[o] = (data[o] as number) * (1 - m) + (channel[y * bw + x] as number) * m;
      }
    }
  }
}
