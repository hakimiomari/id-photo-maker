import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildSheetPdf } from "../src/sheet/pdf";
import { layoutSheet } from "../src/sheet/tiler";
import { getPaper } from "../src/sheet/papers";
import { getFormat } from "../src/formats/registry";

/**
 * A minimal valid baseline JPEG (1×1 px) so embedJpg has real data to parse.
 */
const TINY_JPEG = Uint8Array.from(
  atob(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
      "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB" +
      "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
  ),
  (c) => c.charCodeAt(0),
);

const MM_TO_PT = 72 / 25.4;

describe("buildSheetPdf", () => {
  it("produces a page at the paper's exact physical size", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    const bytes = await buildSheetPdf({ layout, photos: [TINY_JPEG] });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(100 * MM_TO_PT, 3);
    expect(page.getHeight()).toBeCloseTo(150 * MM_TO_PT, 3);
  });

  it("swaps page dimensions for a landscape layout", async () => {
    const layout = layoutSheet(getFormat("cv-photo"), getPaper("13x18"));
    expect(layout.landscape).toBe(true);
    const bytes = await buildSheetPdf({ layout, photos: [TINY_JPEG] });
    const page = (await PDFDocument.load(bytes)).getPage(0);
    expect(page.getWidth()).toBeCloseTo(180 * MM_TO_PT, 3);
    expect(page.getHeight()).toBeCloseTo(130 * MM_TO_PT, 3);
  });

  it("embeds the photo once and draws it per position", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    const bytes = await buildSheetPdf({ layout, photos: [TINY_JPEG] });

    const text = new TextDecoder("latin1").decode(bytes);
    // One embedded image object regardless of copy count…
    expect(text.split("/Subtype /Image").length - 1).toBe(1);
    // …and the file stays compact: six embedded copies would blow this budget.
    expect(bytes.byteLength).toBeLessThan(20_000);
  });

  it("sets document metadata", async () => {
    const layout = layoutSheet(getFormat("us-passport"), getPaper("a4"));
    const bytes = await buildSheetPdf({
      layout,
      photos: [TINY_JPEG],
      title: "US passport sheet",
    });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe("US passport sheet");
    expect(doc.getProducer()).toBe("ID Photo Maker");
  });
});

describe("buildSheetPdf — batch mode", () => {
  it("embeds one image object per member, not per cell", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    expect(layout.copies).toBe(6);
    const bytes = await buildSheetPdf({ layout, photos: [TINY_JPEG, TINY_JPEG] });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.split("/Subtype /Image").length - 1).toBe(2);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("honours an explicit assignment", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    const bytes = await buildSheetPdf({
      layout,
      photos: [TINY_JPEG, TINY_JPEG],
      assignment: [0, 1, 0, 1, 0, 1],
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects an assignment that does not cover the sheet", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    await expect(
      buildSheetPdf({ layout, photos: [TINY_JPEG], assignment: [0, 0] }),
    ).rejects.toThrow(/covers 2 cells/);
  });

  it("rejects an empty photo list", async () => {
    const layout = layoutSheet(getFormat("eu-biometric-35x45"), getPaper("10x15"));
    await expect(buildSheetPdf({ layout, photos: [] })).rejects.toThrow(/no photos/);
  });
});
