#!/usr/bin/env node
/**
 * Download the MediaPipe WASM runtime and face-landmarker model into
 * public/models so the app can be self-hosted (and cached offline by the
 * service worker in Phase 2).
 *
 * After running, set in .env.local:
 *   NEXT_PUBLIC_MEDIAPIPE_BASE=/models/wasm
 *   NEXT_PUBLIC_MEDIAPIPE_MODEL=/models/face_landmarker.task
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "models");

const VERSION = "0.10.20";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;

const FILES = [
  { url: `${CDN}/vision_wasm_internal.js`, path: "wasm/vision_wasm_internal.js" },
  { url: `${CDN}/vision_wasm_internal.wasm`, path: "wasm/vision_wasm_internal.wasm" },
  {
    url: `${CDN}/vision_wasm_nosimd_internal.js`,
    path: "wasm/vision_wasm_nosimd_internal.js",
  },
  {
    url: `${CDN}/vision_wasm_nosimd_internal.wasm`,
    path: "wasm/vision_wasm_nosimd_internal.wasm",
  },
  {
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    path: "face_landmarker.task",
  },
];

for (const file of FILES) {
  const target = join(outDir, file.path);
  await mkdir(dirname(target), { recursive: true });
  process.stdout.write(`↓ ${file.path} … `);
  const response = await fetch(file.url);
  if (!response.ok) {
    console.error(`failed (${response.status} ${response.statusText})`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(target, bytes);
  console.log(`${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
}

console.log(
  "\nDone. Add these to apps/web/.env.local:\n" +
    "  NEXT_PUBLIC_MEDIAPIPE_BASE=/models/wasm\n" +
    "  NEXT_PUBLIC_MEDIAPIPE_MODEL=/models/face_landmarker.task",
);
