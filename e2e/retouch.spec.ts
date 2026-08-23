import { expect, test } from "@playwright/test";
import { openAdjustTab, openDownloadTab } from "./shell";

/**
 * Manual retouch tools: heal tap, smoothing stroke, custom uploaded attire,
 * then an export carrying all three. Runs on the sample photo with the default
 * generic-3x4 format (lenient policy).
 */

test("heal + smooth + custom attire → export", async ({ page, request }) => {
  test.setTimeout(120_000);
  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(page.getByRole("button", { name: "Use another photo" })).toBeVisible({
    timeout: 60_000,
  });

  const canvas = page.locator('[role="application"]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Heal: pick the tool, tap the face area.
  await openAdjustTab(page, "Retouch");
  await page.getByRole("button", { name: "Heal spots" }).click();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page.getByText("1 edit", { exact: true })).toBeVisible();

  // Smooth: paint a short stroke (element-anchored positions — raw viewport
  // coordinates land off the element when the page is scrolled).
  await page.getByRole("button", { name: "Smooth skin" }).click();
  await canvas.hover({ position: { x: box!.width / 2 - 30, y: box!.height / 2 } });
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await canvas.hover({ position: { x: box!.width / 2 - 30 + i * 12, y: box!.height / 2 } });
  }
  await page.mouse.up();
  await expect(page.getByText("2 edits", { exact: true })).toBeVisible();

  // Undo removes the stroke.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("1 edit", { exact: true })).toBeVisible();

  // Custom attire: generate a "tie" PNG in-page and upload it.
  const tie = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 400;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#7A1F2B";
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.lineTo(140, 60);
    ctx.lineTo(115, 320);
    ctx.lineTo(100, 400);
    ctx.lineTo(85, 320);
    ctx.lineTo(60, 60);
    ctx.closePath();
    ctx.fill();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const buf = await blob!.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });
  await page
    .locator('input[type="file"][accept*="png"]')
    .setInputFiles({ name: "tie.png", mimeType: "image/png", buffer: Buffer.from(tie) });

  // Attire tool activates with size/rotation controls; adjust both.
  await expect(page.getByText("Rotation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove attire" })).toBeVisible();

  // Export carries the retouch pipeline (ops replay + attire at source res).
  await openDownloadTab(page, "Photo");
  await page.getByRole("button", { name: /Download photo \(JPEG\)/ }).click();
  await expect(page.getByText("Your photo is ready.")).toBeVisible({ timeout: 60_000 });
});

test("retouch is locked on strict formats with an explanation", async ({ page, request }) => {
  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/?format=us-passport");
  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(page.getByRole("button", { name: "Use another photo" })).toBeVisible({
    timeout: 60_000,
  });

  await openAdjustTab(page, "Retouch");
  await expect(page.getByText(/Retouching is disabled for this document/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Heal spots" })).toHaveCount(0);
});
