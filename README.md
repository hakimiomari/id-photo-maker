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
| 2 | Print sheet + PDF, SEO pages EN/DE, PWA/offline (e2e-verified), sample-photo demo, 14 formats | ✅ done |
| 3 | Background removal (ONNX), mask-refined crown detection | ⬜ |
| 4 | Compliance pre-check, camera capture, batch mode, i18n, Pro tier | ⬜ |

`packages/core/src/segment/` does not exist yet; it arrives with Phase 3.

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
pnpm test           # 129 unit tests in packages/core
pnpm e2e            # 13 Playwright browser tests, incl. full-pipeline + offline
pnpm typecheck
pnpm build
pnpm lint:privacy   # fails if any network primitive appears in packages/core
```

## Layout

```
packages/core/          @photomaker/core — framework-agnostic TypeScript
  src/geometry/         crop solver + unit conversions  ← the heart of the product
  src/formats/          formats.json registry + zod schema
  src/sheet/            print-sheet tiler, sheet renderer, PDF builder, papers
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

## Gotchas

**Never run `pnpm build` while `pnpm dev` is running.** They share `apps/web/.next`,
and the build deletes the dev server's manifests mid-flight. The page keeps
rendering but its JavaScript 500s, so the UI goes completely inert. Fix:
`rm -rf apps/web/.next` and restart dev.

**The CSP must allow `'unsafe-eval'` in development only.** Next's dev server
compiles every module through `eval()`, so a strict CSP kills hydration silently —
the server HTML renders fine while no event handler ever attaches. `next.config.mjs`
adds it for dev and withholds it in production. The `is hydrated` e2e test guards
this class of bug.

**Model loading goes through `importScripts()` in the worker**, which is governed
by `script-src`, not `connect-src`. Self-hosting the models (`fetch:models`) keeps
everything same-origin; the jsdelivr entry in `script-src` exists only for the
zero-config path.

## Test coverage notes

`e2e/pipeline.spec.ts` drives the full ready state using the bundled sample
portrait (demo mode): detection → live validation → sheet PDF export with the
produced PDF byte-verified, then a single-photo export after the sheet
round-trip. `e2e/offline.spec.ts` proves the §5.7 claim: one online visit, then
the entire pipeline again with the network disabled. The annotated fixture
suite for head-bound *accuracy* (≥30 diverse portraits) is still outstanding.

## Before public launch

The spec's Definition of Done (§12) is not met yet. Outstanding:

- [ ] Verify all 14 seed formats against their `source_url`, flip to `verified`
- [ ] Physically test a print at a drugstore kiosk for true size
- [ ] Device lab: iPhone Safari with a 48 MP photo, mid-range Android
- [ ] Impressum + privacy policy pages
- [ ] Lighthouse budgets in CI
- [ ] Fixture suite of ≥30 annotated portraits for head-bound accuracy
