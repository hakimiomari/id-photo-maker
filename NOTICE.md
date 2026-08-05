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

## Not yet added

| Component | Purpose | Licence status |
|---|---|---|
| Background segmentation model (Phase 3) | Portrait matting | **Undecided.** MODNet (Apache-2.0) is the intended choice. BRIA RMBG-1.4 / 2.0 are non-commercial and **must not** be used. Record the model name, source URL, licence and file hash here before merging Phase 3. |

## Model file integrity

Self-hosted model files are fetched by `apps/web/scripts/fetch-models.mjs`.
Record their SHA-256 hashes here once the app pins self-hosted copies rather
than the CDN.
