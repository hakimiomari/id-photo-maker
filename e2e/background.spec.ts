import { expect, test } from "@playwright/test";
import { expandChecks, openAdjustTab, openDownloadTab } from "./shell";

/**
 * Background removal end to end (§5.3): sample photo → MODNet inference in the
 * segment worker → fill preselected from the format spec → matte-composed
 * export. Skips when the segmentation model has not been fetched.
 */

test("remove background → required fill → matted export", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);

  const faceModel = await request.get("/models/face_landmarker.task");
  test.skip(!faceModel.ok(), "Face model missing — run fetch:models");
  const modnet = await request.get("/models/modnet.onnx");
  test.skip(!modnet.ok(), "MODNet missing — run fetch:models");

  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(
    page.getByRole("button", { name: "Use another photo" }),
  ).toBeVisible({ timeout: 60_000 });

  // Run segmentation. WASM CPU inference can take a while on slow machines.
  await openAdjustTab(page, "Background");
  await page.getByRole("button", { name: "Remove background" }).click();
  await expect(
    page.getByRole("button", { name: /^Required · / }),
  ).toBeVisible({ timeout: 120_000 });

  // The format's required colour is preselected (§5.3).
  await expect(page.getByRole("button", { name: /^Required · / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Crown refinement note appears; the head-height check still renders.
  await expect(page.getByText(/exact hair outline/)).toBeVisible();
  await expandChecks(page);
  await expect(page.getByText(/Head height: [\d.]+ mm/)).toBeVisible();

  // Before/after toggle works.
  const toggle = page.getByRole("button", { name: "Show original" });
  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Showing original" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Showing original" }).click();

  // Export with the matte applied still produces a file.
  await openDownloadTab(page, "Photo");
  await page.getByRole("button", { name: /Download photo \(JPEG\)/ }).click();
  await expect(page.getByText("Your photo is ready.")).toBeVisible({
    timeout: 60_000,
  });
});
