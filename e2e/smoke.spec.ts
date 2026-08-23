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

test("SEO page renders the spec and deep-links into the editor", async ({ page }) => {
  await page.goto("/us-passport-photo");

  await expect(
    page.getByRole("heading", { level: 1, name: /US passport \/ visa photo/ }),
  ).toBeVisible();
  // The spec table carries the registry's numbers.
  await expect(page.getByText("51 × 51 mm").first()).toBeVisible();
  await expect(page.getByText("Official requirements")).toBeVisible();
  // FAQ JSON-LD is embedded for search engines.
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(jsonLd!)["@type"]).toBe("FAQPage");

  // The CTA opens the editor with the format preselected.
  await page.getByRole("link", { name: "Open in the editor" }).click();
  await expect(
    page.getByRole("heading", { name: /US passport \/ visa · 51 × 51 mm/ }),
  ).toBeVisible();
});

test("German SEO page renders localized content", async ({ page }) => {
  await page.goto("/de/de-fuehrerschein-photo");
  await expect(
    page.getByRole("heading", { level: 1, name: /Führerschein/ }),
  ).toBeVisible();
  await expect(page.getByText("Offizielle Anforderungen")).toBeVisible();
  await expect(page.getByText("Kopfhöhe (Kinn bis Scheitel)")).toBeVisible();
});

test("Dari and Pashto SEO pages render right-to-left", async ({ page }) => {
  await page.goto("/fa/us-passport-photo");
  const mainFa = page.locator("main");
  await expect(mainFa).toHaveAttribute("dir", "rtl");
  await expect(mainFa).toHaveAttribute("lang", "fa-AF");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("پاسپورت");
  // Registry numbers survive translation untouched.
  await expect(page.getByText("51 × 51").first()).toBeVisible();

  await page.goto("/ps/de-fuehrerschein-photo");
  const mainPs = page.locator("main");
  await expect(mainPs).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("جواز");

  // Deep-link lands in the editor with format AND language preselected.
  await page.getByRole("link", { name: "په ایډیټر کې یې پرانیزئ" }).click();
  await page.waitForURL(/format=de-fuehrerschein/);
  await expect(
    page.getByRole("heading", { name: /د آلمان د موټر چلونې جواز · 35 × 45 mm/ }),
  ).toBeVisible();
});

test("editor language switch: Dari applies, mirrors, persists", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("dir", "ltr");

  await page.getByLabel("Language").selectOption("fa");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("lang", "fa-AF");
  await expect(page.getByRole("button", { name: "انتخاب عکس" })).toBeVisible();

  // Persists across reload.
  await page.reload();
  await expect(html).toHaveAttribute("dir", "rtl");

  // The landing-page CTA deep-links the language too.
  await page.goto("/ps/us-passport-photo");
  await page.getByRole("link", { name: "په ایډیټر کې یې پرانیزئ" }).click();
  await expect(html).toHaveAttribute("lang", "ps");
  await expect(page.getByRole("button", { name: "عکس وټاکئ" })).toBeVisible();

  // Back to English for the remaining tests' sake.
  await page.getByLabel("ژبه").selectOption("en");
  await expect(html).toHaveAttribute("dir", "ltr");
});

test("unknown format slugs 404", async ({ page }) => {
  const response = await page.goto("/klingon-passport-photo");
  expect(response?.status()).toBe(404);
});

test("theme toggle: dark applies, persists, and system follows the OS", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");

  // Explicit dark wins regardless of OS preference…
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(html).toHaveClass(/dark/);

  // …and survives a reload via the pre-paint script (no flash of light mode).
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  // Back to light.
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(html).not.toHaveClass(/dark/);

  // System mode follows the emulated OS preference.
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/dark/);
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
