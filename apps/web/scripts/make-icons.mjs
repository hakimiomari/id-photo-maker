#!/usr/bin/env node
/**
 * Rasterize the PWA icons from the logo SVG using Playwright's Chromium
 * (already a dev dependency — no image library needed). Run once; outputs are
 * committed. Maskable icons need full-bleed background with the glyph inside
 * the 80% safe zone.
 */

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
await mkdir(outDir, { recursive: true });

// Glyph centred in the safe zone on the brand-blue tile.
const html = (size) => `<!doctype html><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:#1D4ED8;display:grid;place-items:center">
  <svg width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 32 32" fill="none">
    <rect x="4.5" y="2.5" width="23" height="27" rx="4" fill="rgba(255,255,255,0.12)" stroke="#FFFFFF" stroke-width="1.8"/>
    <circle cx="16" cy="13" r="4.2" stroke="#FFFFFF" stroke-width="1.8"/>
    <path d="M9 25c1.3-3.4 4-5 7-5s5.7 1.6 7 5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
</div></body>`;

const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size));
  const path = join(outDir, `icon-${size}.png`);
  await page.screenshot({ path, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", path);
  await page.close();
}
await browser.close();
