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

/**
 * Hydration guard. A broken CSP (or any client-side crash) still renders the
 * server HTML, so the page *looks* fine while every handler is missing and the
 * whole app is inert. Asserting that a click reaches a real browser dialog is
 * the cheapest proof that React actually took over.
 */
test("is hydrated — the button opens a real file chooser", async ({ page }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.getByRole("button", { name: "Choose a photo" }).click();
  expect((await chooser).isMultiple()).toBe(false);
});

/**
 * The detection path end to end: drop → worker → decode → MediaPipe → verdict.
 * Needs the self-hosted model, so it skips on a checkout that has not run
 * `pnpm --filter @photomaker/web fetch:models`.
 */
test("runs face detection on a dropped photo", async ({ page, request }) => {
  const model = await request.get("/models/face_landmarker.task");
  test.skip(!model.ok(), "Self-hosted model missing — run fetch:models");

  await page.goto("/");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#DCC8BE";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob!], "flat.jpg", { type: "image/jpeg" }));
    document
      .querySelector(".border-dashed")!
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
  });

  // A flat colour field has no face, so this is the expected verdict — and it
  // can only be reached by loading and running the model.
  await expect(page.locator('p[role="alert"]')).toContainText("No face found", {
    timeout: 30_000,
  });
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
