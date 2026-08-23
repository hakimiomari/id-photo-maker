import { expect, test } from "@playwright/test";

/**
 * Family/batch mode (§9): two people share one print sheet. Uses the sample
 * photo for both members — what matters is the flow: add → reset (batch
 * survives) → add → mixed-sheet PDF with two embedded images.
 */

test("two people → one family sheet, byte-verified", async ({ page, request }) => {
  test.setTimeout(120_000);
  const panel = () => page.locator('section[aria-label="Family sheet"]');

  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/");

  // Person 1
  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(page.getByRole("button", { name: "Use another photo" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Add this photo to a family sheet" }).click();
  await expect(panel().getByText("Person 1")).toBeVisible({ timeout: 30_000 });

  // Load the next person — the batch must survive the reset.
  await page.getByRole("button", { name: /Add another person/ }).click();
  await expect(page.getByRole("button", { name: "Try a sample photo" })).toBeVisible();
  await expect(panel().getByText("Person 1")).toBeVisible();

  // Collected members are reloadable from the uploader for further editing.
  await expect(page.getByText(/From your family sheet/)).toBeVisible();
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use another photo" })).toBeVisible({
    timeout: 60_000,
  });
  // Their photo is back in the editor; the batch entry itself is untouched.
  await expect(page.getByText(/Head height: [\d.]+ mm/)).toBeVisible();
  await expect(panel().getByText("Person 1")).toBeVisible();

  // Back to the uploader for the real second person.
  await page.getByRole("button", { name: /Add another person/ }).click();

  // Person 2
  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(page.getByRole("button", { name: "Use another photo" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Add this photo too" }).click();
  await expect(panel().getByText("Person 2")).toBeVisible({ timeout: 30_000 });

  // Fair split is stated up front: 9-up 3×4 sheet → 5 + 4.
  await expect(page.getByText(/2 people/)).toBeVisible();

  // Download the mixed PDF.
  await page.getByRole("button", { name: /Download family sheet \(PDF\)/ }).click();
  await expect(page.getByText("Your family sheet is ready.")).toBeVisible({
    timeout: 30_000,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.locator('a[download$=".pdf"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^family-sheet-.*-2people\.pdf$/);
  const fs = await import("node:fs");
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  // Two members → exactly two embedded image objects, regardless of cell count.
  const text = bytes.toString("latin1");
  expect(text.split("/Subtype /Image").length - 1).toBe(2);

  // Removing a member relabels the rest.
  await page.getByRole("button", { name: "Remove Person 1" }).click();
  await expect(page.getByText(/1 person\b/)).toBeVisible();
});
