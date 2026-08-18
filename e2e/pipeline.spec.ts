import { expect, test } from "@playwright/test";

/**
 * Full-pipeline test: the bundled sample portrait through detection → crop →
 * validation → sheet export, with the produced PDF verified byte-level. This
 * is the browser coverage of the ready state — the region where every UI bug
 * so far has lived. Uses demo mode (§8.1), so it needs no network.
 *
 * Skips (rather than fails) when the self-hosted model is missing, so a fresh
 * checkout still has a green suite.
 */

test("sample photo → detection → sheet PDF, byte-verified", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);

  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample photo" }).click();

  // Ready state: the editor replaces the uploader.
  await expect(
    page.getByRole("button", { name: "Use another photo" }),
  ).toBeVisible({ timeout: 60_000 });

  // The checks panel renders real measurements from the solver.
  await expect(page.getByRole("status")).toContainText(
    /Ready to download|Usable, with warnings/,
  );
  await expect(page.getByText(/Head height: [\d.]+ mm/)).toBeVisible();

  // Sheet download: PDF is the default file-type chip; one button acts.
  await expect(
    page.getByRole("button", { name: "PDF · recommended" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Download sheet \(PDF\)/ }).click();
  await expect(page.getByText("Your print sheet is ready.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/\d+ photos · \d+ × \d+ mm/)).toBeVisible();

  // Byte-verify the artifact really is a PDF.
  const downloadPromise = page.waitForEvent("download");
  await page.locator('a[download$=".pdf"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^sheet-.*up\.pdf$/);
  const path = await download.path();
  const fs = await import("node:fs");
  const bytes = fs.readFileSync(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(10_000);

  // Single-photo export still works after the sheet round-trip — this is the
  // regression test for the transferred-bitmap ownership bug.
  await page.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("button", { name: /Download photo \(JPEG\)/ }).click();
  await expect(page.getByText("Your photo is ready.")).toBeVisible({
    timeout: 30_000,
  });
});
