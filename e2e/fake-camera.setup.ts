/**
 * Playwright globalSetup: build the fake webcam feed.
 *
 * Chromium's --use-file-for-fake-video-capture only accepts Y4M (raw YUV 4:2:0)
 * files, so the bundled sample portrait is converted to a one-frame Y4M here
 * rather than committing a 1.3 MB binary. The output is gitignored.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import { FAKE_CAMERA_FILE, SAMPLE_PORTRAIT } from "./fake-camera.paths";

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** RGB → Y'CbCr (BT.601, limited range), 4:2:0 with 2×2 chroma averaging. */
function toY4m(rgb: Uint8Array, width: number, height: number): Buffer {
  const w2 = width >> 1;
  const h2 = height >> 1;
  const y = Buffer.alloc(width * height);
  const u = Buffer.alloc(w2 * h2);
  const v = Buffer.alloc(w2 * h2);
  const uSum = new Float64Array(w2 * h2);
  const vSum = new Float64Array(w2 * h2);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 3;
      const r = rgb[i]!;
      const g = rgb[i + 1]!;
      const b = rgb[i + 2]!;
      y[row * width + col] = clamp8(16 + 0.257 * r + 0.504 * g + 0.098 * b);
      const c = (row >> 1) * w2 + (col >> 1);
      uSum[c]! += 128 - 0.148 * r - 0.291 * g + 0.439 * b;
      vSum[c]! += 128 + 0.439 * r - 0.368 * g - 0.071 * b;
    }
  }
  for (let c = 0; c < w2 * h2; c++) {
    u[c] = clamp8(uSum[c]! / 4);
    v[c] = clamp8(vSum[c]! / 4);
  }

  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`);
  const frame = Buffer.from("FRAME\n");
  return Buffer.concat([header, frame, y, u, v]);
}

export default async function globalSetup(): Promise<void> {
  // Even dimensions are required for 4:2:0; the sample is 820×1024.
  const { data, info } = await sharp(readFileSync(SAMPLE_PORTRAIT))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width & ~1;
  const height = info.height & ~1;
  if (width !== info.width || height !== info.height) {
    throw new Error(`Sample portrait must have even dimensions, got ${info.width}×${info.height}`);
  }
  mkdirSync(dirname(FAKE_CAMERA_FILE), { recursive: true });
  writeFileSync(FAKE_CAMERA_FILE, toY4m(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height));
}
