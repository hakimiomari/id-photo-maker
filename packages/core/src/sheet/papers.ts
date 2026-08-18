/**
 * Print paper registry. Like formats, papers are data — nothing in the tiler
 * hardcodes a paper dimension.
 */

export interface PaperSize {
  id: string;
  label: Record<string, string>;
  width_mm: number;
  height_mm: number;
  /** Shown in the drugstore help text: what to order this paper as. */
  order_hint?: string;
}

export const PAPERS: readonly PaperSize[] = [
  {
    id: "10x15",
    label: { en: "10 × 15 cm", de: "10 × 15 cm" },
    width_mm: 100,
    height_mm: 150,
    order_hint: "Standard drugstore photo print (10×15 / 4×6″)",
  },
  {
    id: "13x18",
    label: { en: "13 × 18 cm", de: "13 × 18 cm" },
    width_mm: 130,
    height_mm: 180,
  },
  {
    id: "a4",
    label: { en: "A4", de: "A4" },
    width_mm: 210,
    height_mm: 297,
    order_hint: "Home printer, photo paper recommended",
  },
  {
    id: "us-4x6",
    label: { en: "4 × 6 in", de: "4 × 6 Zoll" },
    width_mm: 101.6,
    height_mm: 152.4,
    order_hint: "US drugstore photo print (4×6″)",
  },
];

const byId = new Map(PAPERS.map((p) => [p.id, p]));

export const DEFAULT_PAPER_ID = "10x15";

export function getPaper(id: string): PaperSize {
  const paper = byId.get(id);
  if (!paper) throw new Error(`Unknown paper id: ${id}`);
  return paper;
}

export function paperLabel(paper: PaperSize, locale = "en"): string {
  return paper.label[locale] ?? paper.label.en ?? paper.id;
}
