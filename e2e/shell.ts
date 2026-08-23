import type { Page } from "@playwright/test";

/**
 * App-shell navigation helpers: since the shell restructure, tools live behind
 * step + tab navigation, and the checks list sits behind the status banner.
 */

export async function openStep(page: Page, name: "Format" | "Adjust" | "Download") {
  await page
    .locator('ol[aria-label="Progress"]')
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

export async function openAdjustTab(
  page: Page,
  name: "Crop" | "Background" | "Retouch",
) {
  await openStep(page, "Adjust");
  await page.getByRole("tab", { name }).click();
}

export async function openDownloadTab(
  page: Page,
  name: "Photo" | "Print sheet" | "Family sheet",
) {
  await openStep(page, "Download");
  await page.getByRole("tab", { name }).click();
}

/** Expand the status banner so the full checks list is visible. */
export async function expandChecks(page: Page) {
  const banner = page.getByRole("button", { name: "Photo checks" });
  if ((await banner.getAttribute("aria-expanded")) !== "true") {
    await banner.click();
  }
}
