/**
 * Portrait-matting math (spec §5.3) — everything around the ONNX session,
 * which lives in the web app's segment worker. Pure and unit-tested here:
 * inference sizing, tensor prep, matte → alpha, bilinear upsampling.
 *
 * Model contract (MODNet, photographic portrait matting):
 *   input  "input":  float32 NCHW, RGB, normalized (x − 127.5) / 127.5,
 *                    height/width divisible by 32
 *   output "output": float32 [1, 1, H, W], matte in [0, 1]
 */

import type { Size } from "../types";

export const MODNET_REF_SIZE = 512;

/**
 * Inference resolution: longest edge scaled to `ref`, both sides rounded to
 * the nearest multiple of 32 (minimum 32). MODNet was trained at this scale;
 * feeding it full-resolution frames costs seconds and *reduces* quality.
 */
export function inferenceSize(size: Size, ref = MODNET_REF_SIZE): Size {
  const scale = ref / Math.max(size.width, size.height);
  const round32 = (v: number) => Math.max(32, Math.round(v / 32) * 32);
  return {
    width: round32(size.width * scale),
    height: round32(size.height * scale),
  };
}

/** RGBA ImageData bytes → normalized NCHW float32 planes (RGB). */
export function toModNetInput(
  rgba: Uint8ClampedArray | Uint8Array,
  size: Size,
): Float32Array {
  const { width, height } = size;
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    out[i] = ((rgba[o] as number) - 127.5) / 127.5;
    out[plane + i] = ((rgba[o + 1] as number) - 127.5) / 127.5;
    out[2 * plane + i] = ((rgba[o + 2] as number) - 127.5) / 127.5;
  }
  return out;
}

/** Float matte [0,1] → clamped 8-bit alpha. */
export function matteToAlpha(matte: Float32Array): Uint8Array {
  const out = new Uint8Array(matte.length);
  for (let i = 0; i < matte.length; i++) {
    const v = matte[i] as number;
    out[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  return out;
}

/**
 * Bilinear resize of a single-channel 8-bit mask. Deterministic TS rather than
 * canvas scaling so it behaves identically in workers, tests and node.
 */
export function bilinearResizeAlpha(
  src: Uint8Array,
  srcSize: Size,
  dstSize: Size,
): Uint8Array {
  const { width: sw, height: sh } = srcSize;
  const { width: dw, height: dh } = dstSize;
  if (sw === dw && sh === dh) return src.slice();

  const out = new Uint8Array(dw * dh);
  const xRatio = sw > 1 ? (sw - 1) / Math.max(1, dw - 1) : 0;
  const yRatio = sh > 1 ? (sh - 1) / Math.max(1, dh - 1) : 0;

  for (let y = 0; y < dh; y++) {
    const fy = y * yRatio;
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = x * xRatio;
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;

      const a = src[y0 * sw + x0] as number;
      const b = src[y0 * sw + x1] as number;
      const c = src[y1 * sw + x0] as number;
      const d = src[y1 * sw + x1] as number;
      out[y * dw + x] = Math.round(
        a * (1 - wx) * (1 - wy) +
          b * wx * (1 - wy) +
          c * (1 - wx) * wy +
          d * wx * wy,
      );
    }
  }
  return out;
}

/** Fraction of pixels considered foreground — sanity gate on a returned mask. */
export function foregroundRatio(alpha: Uint8Array, threshold = 128): number {
  if (alpha.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < alpha.length; i++) {
    if ((alpha[i] as number) >= threshold) count++;
  }
  return count / alpha.length;
}
