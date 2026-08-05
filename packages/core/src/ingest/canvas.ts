/**
 * Canvas helpers that work in both window and worker contexts.
 * OffscreenCanvas is used wherever available; HTMLCanvasElement is the fallback
 * for older Safari on the main thread.
 */

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export type AnyContext2D =
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === "undefined") {
    throw new Error("No canvas implementation available in this context");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2d(
  canvas: AnyCanvas,
  options?: CanvasRenderingContext2DSettings,
): AnyContext2D {
  const ctx = canvas.getContext("2d", options) as AnyContext2D | null;
  if (!ctx) throw new Error("Could not acquire a 2D canvas context");
  return ctx;
}

/**
 * Free a canvas eagerly. iOS Safari accounts canvas memory globally and is
 * unforgiving; zero-sizing releases the backing store immediately (§6.2).
 */
export function releaseCanvas(canvas: AnyCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function canvasToBlob(
  canvas: AnyCanvas,
  type: string,
  quality?: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality });
  }
  const el = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null")),
      type,
      quality,
    );
  });
}
