import { expect, test } from "@playwright/test";
import { expandChecks } from "./shell";

/**
 * Camera capture (§4.7): open the in-app camera, get live guidance from the
 * face mesh, take a timed photo, and land in the editor through the same
 * pipeline as an upload. The "webcam" is Chromium's fake device replaying the
 * sample portrait (see playwright.config.ts), so this needs no hardware.
 *
 * Skips when the self-hosted model is missing, like the pipeline test.
 */

test("camera → live guidance → timed capture → editor", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);

  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/");
  await page.getByRole("button", { name: "Take a photo" }).click();

  const camera = page.getByTestId("camera-capture");
  await expect(camera).toBeVisible();
  await expect(camera.getByText("Live video stays on your device")).toBeVisible();

  // The live loop finds the face and says what to do. The fake frame is a
  // 820×1024 portrait with a smallish head, so it should ask to move closer,
  // but any real hint proves detection ran on the stream.
  const hint = camera.getByRole("status");
  await expect(hint).not.toHaveText(/Looking for your face/, { timeout: 60_000 });
  await expect(hint).not.toHaveText(/Position your face/, { timeout: 30_000 });

  // Timed capture: the button counts down, then the photo goes through
  // decode → detect and the editor takes over.
  await camera.getByRole("button", { name: /Take photo/ }).click();
  await expect(camera.getByText(/Taking photo in/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use another photo" }),
  ).toBeVisible({ timeout: 60_000 });

  // Same checks panel as an upload; the frame is a real JPEG, not a mirror.
  await expect(page.getByRole("button", { name: "Photo checks" })).toContainText(
    /Ready to download|Usable, with warnings/,
  );
  await expandChecks(page);
  await expect(page.getByText(/Head height: [\d.]+ mm/)).toBeVisible();
});

test("cancel closes the camera and releases the uploader", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Take a photo" }).click();
  await expect(page.getByTestId("camera-capture")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Choose a photo" })).toBeVisible();
});
