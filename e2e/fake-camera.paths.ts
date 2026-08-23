import path from "node:path";

/** Shared between playwright.config.ts (launch flag) and the globalSetup (writer). */
export const SAMPLE_PORTRAIT = path.resolve(
  __dirname,
  "../apps/web/public/sample-portrait.jpg",
);
export const FAKE_CAMERA_FILE = path.resolve(__dirname, "fixtures/portrait.y4m");
