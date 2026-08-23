#!/usr/bin/env node
/**
 * Download the ML models into public/models so the app serves them
 * same-origin. Runs before every production build (see the `build` script),
 * which is how deployments (Vercel) get the models — public/models is
 * gitignored.
 *
 * Downloads are VERIFIED, not trusted: every file has a minimum size and an
 * HTML sniff, and the matting model is pinned by sha256 (must match
 * NOTICE.md). A CDN answering a build machine with a challenge page fails the
 * build loudly instead of deploying a broken feature.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "models");

const MP_VERSION = "0.10.20";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;

/** Pinned in NOTICE.md — update both together, never just one. */
const MODNET_SHA256 =
  "07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9";

const FILES = [
  {
    url: `${CDN}/vision_wasm_internal.js`,
    path: "wasm/vision_wasm_internal.js",
    minBytes: 50_000,
  },
  {
    url: `${CDN}/vision_wasm_internal.wasm`,
    path: "wasm/vision_wasm_internal.wasm",
    minBytes: 5_000_000,
  },
  {
    url: `${CDN}/vision_wasm_nosimd_internal.js`,
    path: "wasm/vision_wasm_nosimd_internal.js",
    minBytes: 50_000,
  },
  {
    url: `${CDN}/vision_wasm_nosimd_internal.wasm`,
    path: "wasm/vision_wasm_nosimd_internal.wasm",
    minBytes: 5_000_000,
  },
  {
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    path: "face_landmarker.task",
    minBytes: 2_000_000,
  },
  {
    // MODNet photographic portrait matting, ONNX export (Apache-2.0).
    url: "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx",
    path: "modnet.onnx",
    minBytes: 20_000_000,
    sha256: MODNET_SHA256,
  },
];

const failures = [];

function verify(bytes, file) {
  // An HTML challenge/error page saved as a model is the failure mode that
  // silently breaks production — sniff for it explicitly.
  if (bytes[0] === 0x3c /* "<" */) {
    return `looks like an HTML page, not a binary (CDN challenge or error page?)`;
  }
  if (bytes.length < file.minBytes) {
    return `only ${bytes.length} bytes (expected at least ${file.minBytes})`;
  }
  if (file.sha256) {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== file.sha256) {
      return `sha256 mismatch\n    expected ${file.sha256}\n    got      ${actual}`;
    }
  }
  return null;
}

async function download(file) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(file.url, {
        redirect: "follow",
        // Some CDNs challenge default runtime UAs from datacenter IPs.
        headers: { "User-Agent": "id-photo-maker-build/1.0 (+node fetch)" },
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`;
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        const problem = verify(bytes, file);
        if (!problem) return bytes;
        lastError = problem;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error(lastError);
}

for (const file of FILES) {
  const target = join(outDir, file.path);
  await mkdir(dirname(target), { recursive: true });

  // Idempotent — but "present" only counts if the existing file verifies.
  // A previously saved bad download must never survive a rebuild.
  if (existsSync(target)) {
    const existing = await readFile(target);
    if (!verify(existing, file)) {
      console.log(`✓ ${file.path} already present (verified)`);
      continue;
    }
    console.log(`✗ ${file.path} present but invalid — re-downloading`);
    await rm(target);
  }

  process.stdout.write(`↓ ${file.path} … `);
  try {
    const bytes = await download(file);
    await writeFile(target, bytes);
    console.log(`${(bytes.length / 1024 / 1024).toFixed(1)} MB ✓`);
  } catch (error) {
    console.error(`FAILED: ${error.message}`);
    failures.push(file.path);
  }
}

if (failures.length > 0) {
  console.error(
    `\nModel fetch failed for: ${failures.join(", ")}\n` +
      "Refusing to continue — a build without verified models would deploy a " +
      "silently broken app. Re-run the build; if Hugging Face keeps failing " +
      "from this network, download the file manually and place it in " +
      "apps/web/public/models/ (the sha256 above must match).",
  );
  process.exit(1);
}

// onnxruntime-web's wasm/mjs binaries must match the installed package
// version exactly, so copy them from node_modules rather than a CDN.
const require = createRequire(import.meta.url);
// The main entry resolves into the package's dist/ directory.
const ortDist = dirname(require.resolve("onnxruntime-web"));
const ortOut = join(outDir, "ort");
await mkdir(ortOut, { recursive: true });
// Only the runtimes the segment worker can actually select: the plain build
// (wasm EP) and the JSEP build (webgpu EP). The asyncify/jspi variants would
// add ~60 MB to every deployment for nothing.
const ORT_FILES = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];
for (const file of ORT_FILES) {
  await cp(join(ortDist, file), join(ortOut, file));
}
console.log(`✓ copied ${ORT_FILES.length} onnxruntime-web runtime files to models/ort/`);
