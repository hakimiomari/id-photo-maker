# ID Photo Maker

Free, browser-based passport and ID photo maker. Upload a portrait, get a
print-ready, correctly sized photo for a chosen document format.

**Photos never leave the device.** There is no upload endpoint. Decoding, face
detection, cropping and encoding all run in the browser, in Web Workers. This is
enforced in CI (`pnpm lint:privacy`), not just promised.

---

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Monorepo scaffold, format registry + schema, CI | ✅ done |
| 1 | Ingest → detect → crop solver → adjust UI → JPEG/PNG export **with DPI metadata** | ✅ done |
| 2 | Print sheet + PDF, SEO pages, PWA/offline, full format buildout | ⬜ next |
| 3 | Background removal (ONNX), mask-refined crown detection | ⬜ |
| 4 | Compliance pre-check, camera capture, batch mode, i18n, Pro tier | ⬜ |

`packages/core/src/segment/` and `packages/core/src/sheet/` do not exist yet;
they arrive with Phases 3 and 2 respectively.

## Getting started

```bash
corepack enable pnpm
pnpm install
pnpm dev            # http://localhost:3000
```

Model files (MediaPipe WASM + face landmarker, ~7 MB) load from a CDN by
default. To self-host them — required for the offline PWA:

```bash
pnpm --filter @photomaker/web fetch:models
# then add to apps/web/.env.local:
#   NEXT_PUBLIC_MEDIAPIPE_BASE=/models/wasm
#   NEXT_PUBLIC_MEDIAPIPE_MODEL=/models/face_landmarker.task
```

## Commands

```bash
pnpm test           # 109 unit tests in packages/core
pnpm e2e            # 6 Playwright smoke tests (builds + serves the app)
pnpm typecheck
pnpm build
pnpm lint:privacy   # fails if any network primitive appears in packages/core
```

## Layout

```
packages/core/          @photomaker/core — framework-agnostic TypeScript
  src/geometry/         crop solver + unit conversions  ← the heart of the product
  src/formats/          formats.json registry + zod schema
  src/ingest/           decode, EXIF orientation, downscale, canvas helpers
  src/detect/           MediaPipe wrapper, chin/crown estimation
  src/render/           canvas render pipeline
  src/export/           encode + JPEG JFIF / PNG pHYs density injection
  tests/                Vitest — geometry and byte-level metadata tests
apps/web/               Next.js 15 App Router UI
  workers/              detect + encode Web Workers
  lib/                  zustand store, typed worker protocol, overlay drawing
scripts/                CI privacy gate
```

## The two things that matter most

**1. The crop solver** (`packages/core/src/geometry/cropSolver.ts`). A photo with
the wrong head-height ratio gets an application rejected, so this file is pure,
exhaustively tested, and reads every dimension from the format registry — never
from a constant.

**2. DPI metadata** (`packages/core/src/export/`). `canvas.toBlob()` writes no
density information, so a print service would assume 72 DPI and print a 35 × 45 mm
photo about eight times too large. Every export goes through `encodeCanvas()`,
which patches the JPEG JFIF APP0 segment or inserts a PNG `pHYs` chunk. Both are
verified byte-for-byte in tests.

## Adding a format

Add an entry to `packages/core/src/formats/formats.json`. Nothing else — no
logic anywhere hardcodes a dimension. The zod schema in `schema.ts` is enforced
in CI, so a self-contradictory entry (head taller than the photo, inverted
range, missing source URL) fails the build.

New entries start at `verification_status: "seeded"`, which makes the UI show a
weaker claim. Flipping one to `"verified"` means a human re-read `source_url`
and confirmed every number — do not automate it.

## What is *not* covered by tests yet

The e2e suite verifies page load, format switching, the ingest error path
(file → worker → store → UI) and that no non-GET request is ever made. It does
**not** yet exercise the ready state — detection, the crop overlay and export
need a real portrait plus a ~7 MB model download. That belongs with the
annotated fixture suite in Phase 2, and until then the crop and export paths are
covered only by unit tests, not by a browser run.

## Before public launch

The spec's Definition of Done (§12) is not met yet. Outstanding:

- [ ] Verify all 11 seed formats against their `source_url`, flip to `verified`
- [ ] Physically test a print at a drugstore kiosk for true size
- [ ] Device lab: iPhone Safari with a 48 MP photo, mid-range Android
- [ ] Impressum + privacy policy pages
- [ ] Lighthouse budgets in CI
- [ ] Fixture suite of ≥30 annotated portraits for head-bound accuracy
