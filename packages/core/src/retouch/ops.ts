/**
 * Manual retouch operations (Photoshop-style: the user aims every change).
 *
 * Ops are recorded in *working-copy* pixel coordinates and replayed at any
 * scale — the preview applies them at working resolution, the export replays
 * them on the full-resolution source. Everything is deterministic: same ops,
 * same output, no randomness.
 */

import type { Size } from "../types";

/** One tap of the healing brush: repair a circular spot. */
export interface HealOp {
  kind: "heal";
  x: number;
  y: number;
  radius: number;
}

/** One stroke of the smoothing brush: a polyline painted over skin. */
export interface SmoothOp {
  kind: "smooth";
  /** Stroke path; consecutive points are connected. */
  points: Float32Array;
  radius: number;
  /** 0–1 blend of the smoothed result. */
  strength: number;
}

export type RetouchOp = HealOp | SmoothOp;

/** The uploaded attire overlay (tie/suit/scarf) and its placement. */
export interface AttireTransform {
  /** Centre in working px. */
  cx: number;
  cy: number;
  /** Rendered width in working px (height follows the image aspect). */
  width: number;
  /** Rotation in degrees. */
  rotation: number;
}

/** Scale an op's geometry by `k` (working px → source px). */
export function scaleOp(op: RetouchOp, k: number): RetouchOp {
  if (op.kind === "heal") {
    return { kind: "heal", x: op.x * k, y: op.y * k, radius: op.radius * k };
  }
  const points = new Float32Array(op.points.length);
  for (let i = 0; i < op.points.length; i++) points[i] = (op.points[i] as number) * k;
  return { kind: "smooth", points, radius: op.radius * k, strength: op.strength };
}

/** Paint a stroke's coverage into an 8-bit mask (255 inside the brush path). */
export function paintStrokeMask(
  mask: Uint8Array,
  size: Size,
  op: SmoothOp,
): void {
  const points = op.points;
  const count = points.length / 2;
  if (count === 0) return;

  const stamp = (cx: number, cy: number) => {
    const r = op.radius;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(size.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(size.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        // Soft-edged brush: full inside 70 %, feathered to the rim.
        const a = d <= 0.7 ? 255 : Math.round(255 * (1 - (d - 0.7) / 0.3));
        const i = y * size.width + x;
        if (a > (mask[i] as number)) mask[i] = a;
      }
    }
  };

  let px = points[0] as number;
  let py = points[1] as number;
  stamp(px, py);
  for (let p = 1; p < count; p++) {
    const nx = points[p * 2] as number;
    const ny = points[p * 2 + 1] as number;
    // Interpolate stamps so fast strokes leave no gaps.
    const dist = Math.hypot(nx - px, ny - py);
    const steps = Math.max(1, Math.ceil(dist / (op.radius * 0.4)));
    for (let s = 1; s <= steps; s++) {
      stamp(px + ((nx - px) * s) / steps, py + ((ny - py) * s) / steps);
    }
    px = nx;
    py = ny;
  }
}
