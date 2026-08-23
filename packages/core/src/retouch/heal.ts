/**
 * Spot healing: replace a circular blemish with a smooth interpolation of the
 * skin around it, feathered into the original. Deterministic ring sampling —
 * no randomness, so preview and full-resolution export match.
 */

import type { Size } from "../types";
import type { HealOp } from "./ops";

/** Fixed sample directions around the ring (deterministic). */
const RING_SAMPLES = 16;
/** Samples sit just outside the blemish. */
const RING_SCALE = 1.3;
/** Inside this fraction of the radius the patch fully replaces the original. */
const CORE = 0.65;

export function healSpot(data: Uint8ClampedArray, size: Size, op: HealOp): void {
  const { width, height } = size;
  const r = Math.max(1, op.radius);
  const ringR = r * RING_SCALE;

  // Collect ring samples (skip those falling outside the image).
  const samples: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
  for (let i = 0; i < RING_SAMPLES; i++) {
    const angle = (i / RING_SAMPLES) * Math.PI * 2;
    const sx = Math.round(op.x + Math.cos(angle) * ringR);
    const sy = Math.round(op.y + Math.sin(angle) * ringR);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
    const o = (sy * width + sx) * 4;
    samples.push({
      x: sx,
      y: sy,
      r: data[o] as number,
      g: data[o + 1] as number,
      b: data[o + 2] as number,
    });
  }
  if (samples.length < 3) return; // spot at the very edge — nothing to sample

  const x0 = Math.max(0, Math.floor(op.x - r));
  const x1 = Math.min(width - 1, Math.ceil(op.x + r));
  const y0 = Math.max(0, Math.floor(op.y - r));
  const y1 = Math.min(height - 1, Math.ceil(op.y + r));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - op.x, y - op.y) / r;
      if (d >= 1) continue;

      // Inverse-distance-weighted blend of the ring: smooth gradient fill that
      // follows the surrounding skin tone in every direction.
      let wr = 0;
      let wg = 0;
      let wb = 0;
      let wsum = 0;
      for (const s of samples) {
        const w = 1 / (Math.hypot(x - s.x, y - s.y) + 0.5);
        wr += s.r * w;
        wg += s.g * w;
        wb += s.b * w;
        wsum += w;
      }

      // Feather: full patch in the core, easing out to the rim.
      const alpha = d <= CORE ? 1 : 1 - (d - CORE) / (1 - CORE);
      const o = (y * width + x) * 4;
      data[o] = (data[o] as number) * (1 - alpha) + (wr / wsum) * alpha;
      data[o + 1] = (data[o + 1] as number) * (1 - alpha) + (wg / wsum) * alpha;
      data[o + 2] = (data[o + 2] as number) * (1 - alpha) + (wb / wsum) * alpha;
    }
  }
}
