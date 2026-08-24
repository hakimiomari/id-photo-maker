# Changelog

All notable changes to ID Photo Maker. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

Releases are cut by pushing a `v*` tag — the `release` workflow publishes the
matching section of this file as the GitHub release notes.

## [Unreleased]

## [1.0.0-beta.1] — 2026-08-23

First public beta. The full pipeline runs entirely in the browser: no photo
data ever leaves the device.

### Added

**Core pipeline**
- Photo ingest (JPEG, PNG, WebP, HEIC), EXIF orientation, memory-safe
  downscaling for the editor with full-resolution export.
- On-device face detection (MediaPipe Face Landmarker) and the crop solver:
  head-height, top-margin and eye-line constraints from a data-driven format
  registry, with live validation.
- Export at true physical size: JPEG JFIF and PNG pHYs density metadata
  written and byte-verified, so prints come out at the right millimetres.
- 14 document formats (EU biometric, UK, US passport/visa, China, India,
  Canada, Japan, South Korea, German driving licence, US DV lottery, generic
  3×4 / 2×3 / 4×6 cm, CV), each with an official source URL and verification
  status.

**Printing**
- Print sheets on 10×15 cm, 13×18 cm, A4 and 4×6″ with cut marks; PDF (true
  to size at kiosks) and JPEG output.
- Family / batch mode: several people share one sheet with a fair contiguous
  split; members can be reloaded into the editor by tap or drag-and-drop.

**Editing**
- Background removal (MODNet via ONNX Runtime, WebGPU with WASM fallback)
  with required-colour presets, custom fill, edge softness and before/after —
  also refines head measurement from the exact hair outline.
- Manual retouching on non-biometric formats: heal brush, smoothing brush,
  and a user-uploaded attire overlay (tie, collar…) with size and rotation.
  Locked with an explanation on passport/visa formats, whose authorities
  reject digitally altered photos.
- Fine-tune sliders (brightness, contrast, saturation), keyboard and touch
  crop control.

**Guidance**
- Compliance pre-check: head pose, eyes, expression, exposure, lighting,
  sharpness, background uniformity — plus a manual checklist for what no
  heuristic can see.
- In-app camera capture with live framing guidance and a countdown.
- Sample photo demo mode.

**App**
- App shell: stepper navigation (Format → Photo → Adjust → Download) with
  tool tabs and a persistent, expandable status banner.
- English, German, Dari and Pashto — editor UI and 56 static SEO landing
  pages (14 formats × 4 languages), right-to-left where the language needs it.
- Light / dark / system theme.
- Installable PWA; the whole pipeline works offline after first use.
- Privacy-safe, cookieless analytics — off by default, CI-enforced allowlist
  of event names, no photo-derived data possible.

### Security & privacy
- CI gate: no network primitives allowed in the core package.
- Strict Content-Security-Policy; models and runtimes self-hosted and
  hash-verified at build time.
- Do Not Track and Global Privacy Control honoured.

### Known limitations (why this is a beta)
- Format specifications are transcribed but not yet re-verified against
  their official sources by a human (`verification_status: seeded`).
- No physical kiosk print has been measured yet; no real-iPhone device test.
- Impressum and privacy-policy pages are not yet present.
- Dari and Pashto copy is machine-drafted and awaiting native review.

[Unreleased]: https://github.com/hakimiomari/id-photo-maker/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/hakimiomari/id-photo-maker/releases/tag/v1.0.0-beta.1
