import { expect, test } from "@playwright/test";

/**
 * Phase 1 smoke tests. These deliberately avoid loading the MediaPipe model:
 * the full upload → download path needs a real portrait and a ~7 MB model
 * download, and belongs in the fixture-driven suite (Phase 2).
 */

test("loads the editor with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "ID Photo Maker" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a photo" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("states the privacy guarantee and the German restriction", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("never leaves your device", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("must be transmitted digitally", { exact: false }),
  ).toBeVisible();
});

test("switching format updates the live spec summary", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /US passport \/ visa/ }).click();
  await expect(
    page.getByRole("heading", { name: /US passport \/ visa · 51 × 51 mm/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Biometric 35 × 45 mm/ }).click();
  await expect(
    page.getByRole("heading", { name: /Biometric 35 × 45 mm · 35 × 45 mm/ }),
  ).toBeVisible();
});

test("filters formats by search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("35x45");

  await expect(
    page.getByRole("button", { name: /Biometric 35 × 45 mm/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /India passport/ }),
  ).toBeHidden();
});

test("rejects an unsupported file with a friendly message", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("this is not a photo"),
  });

  await expect(page.locator('p[role="alert"]')).toContainText(
    "Use a JPEG, PNG, WebP or HEIC photo",
  );
});

test("makes no network request carrying image data", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") posts.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("this is not a photo"),
  });
  await expect(page.locator('p[role="alert"]')).toBeVisible();

  expect(posts).toEqual([]);
});
