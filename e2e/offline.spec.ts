import { expect, test } from "@playwright/test";

/**
 * Offline verification (spec §5.7): after one online visit that exercises
 * detection, the entire pipeline must work with the network gone — page,
 * chunks, WASM runtime, model and sample photo all served by the service
 * worker's caches.
 *
 * Runs against the production server only (the SW deliberately does not
 * register in dev).
 */

test("full pipeline works offline after first use", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180_000);

  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  // --- Online phase: install the SW and warm every cache. ---
  await page.goto("/");
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    undefined,
    { timeout: 20_000 },
  );

  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(
    page.getByRole("button", { name: "Use another photo" }),
  ).toBeVisible({ timeout: 60_000 });

  // --- Offline phase: reload and run the whole pipeline again. ---
  await context.setOffline(true);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ID Photo Maker" }),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Try a sample photo" }).click();
  await expect(
    page.getByRole("button", { name: "Use another photo" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Head height: [\d.]+ mm/)).toBeVisible();

  await context.setOffline(false);
});
