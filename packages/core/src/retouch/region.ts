/**
 * Polygon ("lasso") selections: the user clicks point by point around an
 * area — a beard, the hairline — closes the shape, and applies an effect
 * inside it. Deterministic scanline rasterization + a feathered edge, so the
 * preview and the full-resolution export match.
 */

import type { Size } from "../types";
import { applySmoothing } from "./smooth";
import type { RegionOp } from "./ops";

/** Even-odd scanline fill of a closed polygon ([x0,y0,x1,y1,…]) into a mask. */
export function rasterizePolygon(points: ArrayLike<number>, size: Size): Uint8Array {
  const mask = new Uint8Array(size.width * size.height);
  const n = points.length / 2;
  if (n < 3) return mask;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = points[i * 2 + 1] as number;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(size.height - 1, Math.ceil(maxY));

  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5; // sample at pixel centre
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const ax = points[i * 2] as number;
      const ay = points[i * 2 + 1] as number;
      const j = (i + 1) % n;
      const bx = points[j * 2] as number;
      const by = points[j * 2 + 1] as number;
      if (ay === by) continue;
      if (sy < Math.min(ay, by) || sy >= Math.max(ay, by)) continue;
      xs.push(ax + ((sy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil((xs[k] as number) - 0.5));
      const xb = Math.min(size.width - 1, Math.floor((xs[k + 1] as number) - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * size.width + x] = 255;
    }
  }
  return mask;
}

/** Soften a mask's edges with a separable box blur of the given radius. */
export function featherMask(mask: Uint8Array, size: Size, radius: number): Uint8Array {
  const r = Math.round(radius);
  if (r <= 0) return mask.slice();
  const { width, height } = size;
  const tmp = new Float32Array(width * height);
  const out = new Uint8Array(width * height);
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += mask[y * width + Math.min(width - 1, Math.max(0, k))] as number;
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = sum * norm;
      const outX = Math.min(width - 1, Math.max(0, x - r));
      const inX = Math.min(width - 1, Math.max(0, x + r + 1));
      sum += (mask[y * width + inX] as number) - (mask[y * width + outX] as number);
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += tmp[Math.min(height - 1, Math.max(0, k)) * width + x] as number;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = Math.round(sum * norm);
      const outY = Math.min(height - 1, Math.max(0, y - r));
      const inY = Math.min(height - 1, Math.max(0, y + r + 1));
      sum += (tmp[inY * width + x] as number) - (tmp[outY * width + x] as number);
    }
  }
  return out;
}

/** Strongest darkening at strength 1: pixels inside lose 55 % of their light. */
const DARKEN_MAX = 0.55;

/** Apply a region op (darken / smooth inside the polygon) to pixels in place. */
export function applyRegion(data: Uint8ClampedArray, size: Size, op: RegionOp): void {
  const hard = rasterizePolygon(op.points, size);
  const mask = featherMask(hard, size, op.feather);

  if (op.effect === "smooth") {
    applySmoothing(data, size, mask, 3, op.strength);
    return;
  }
  for (let i = 0; i < mask.length; i++) {
    const m = ((mask[i] as number) / 255) * op.strength;
    if (m === 0) continue;
    const f = 1 - DARKEN_MAX * m;
    const o = i * 4;
    data[o] = (data[o] as number) * f;
    data[o + 1] = (data[o + 1] as number) * f;
    data[o + 2] = (data[o + 2] as number) * f;
  }
}
