/** Unit conversions. Physical sizes are millimetres everywhere in core. */

export const MM_PER_INCH = 25.4;

export function mmToInch(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchToMm(inch: number): number {
  return inch * MM_PER_INCH;
}

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/** Pixels-per-metre, as stored in a PNG pHYs chunk. */
export function dpiToPpm(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

export function ppmToDpi(ppm: number): number {
  return ppm * 0.0254;
}

/**
 * Effective print resolution of a crop: how many source pixels back each inch
 * of the printed photo. Used for the "not enough resolution" gate (§5.1).
 */
export function effectiveDpi(cropSourcePx: number, physicalMm: number): number {
  if (physicalMm <= 0) return 0;
  return cropSourcePx / mmToInch(physicalMm);
}

/** Pixel dimensions of an export at a given DPI, rounded to whole pixels. */
export function exportPixelSize(
  widthMm: number,
  heightMm: number,
  dpi: number,
): { width: number; height: number } {
  return {
    width: Math.round(mmToPx(widthMm, dpi)),
    height: Math.round(mmToPx(heightMm, dpi)),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function midpoint(range: readonly [number, number]): number {
  return (range[0] + range[1]) / 2;
}
