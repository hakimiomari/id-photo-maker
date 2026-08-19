# Third-party components and licences

Every model and library that ships to the browser is listed here with its
licence. **Non-commercial models are forbidden in this product** (§6.4) — a
monetized app cannot ship them.

| Component | Version | Licence | Use | Status |
|---|---|---|---|---|
| `@mediapipe/tasks-vision` | 0.10.x | Apache-2.0 | Face landmark detection (WASM runtime) | ✅ cleared |
| MediaPipe `face_landmarker.task` (float16) | v1 | Apache-2.0 | 478-point face mesh model | ✅ cleared |
| `heic2any` (libheif) | 0.0.x | LGPL-3.0 (libheif: LGPL) | HEIC/HEIF decoding | ✅ cleared — **must stay dynamically imported in its own chunk** (see `packages/core/src/ingest/decode.ts`) |
| `zod` | 3.x | MIT | Format registry validation | ✅ cleared |
| `next`, `react`, `zustand`, `tailwindcss` | — | MIT | App framework and UI | ✅ cleared |
| `pdf-lib` | 1.x | MIT | Print-sheet PDF generation (client-side) | ✅ cleared |
| MediaPipe test portrait (`sample-portrait.jpg`) | — | Apache-2.0 (MediaPipe assets) | Bundled demo photo for “Try a sample photo” and e2e tests | ✅ cleared — source: storage.googleapis.com/mediapipe-assets/portrait.jpg |
| `onnxruntime-web` | 1.27.x | MIT | ONNX inference (WASM/WebGPU) for portrait matting | ✅ cleared — runtime binaries self-hosted from node_modules |
| MODNet photographic portrait matting (`modnet.onnx`) | — | Apache-2.0 (ZHKKKe/MODNet; ONNX export Xenova/modnet) | Background removal (§5.3) + crown refinement (§4.2.3) | ✅ cleared — sha256 `07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9`. **BRIA RMBG models remain forbidden (non-commercial).** |

## Not yet added

_(nothing pending)_

## Model file integrity

Self-hosted model files are fetched by `apps/web/scripts/fetch-models.mjs`.
Record their SHA-256 hashes here once the app pins self-hosted copies rather
than the CDN.
