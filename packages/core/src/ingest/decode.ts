/**
 * File -> upright ImageBitmap, with hard input limits (§5.1) and EXIF
 * orientation baked in.
 */

import { createCanvas, get2d, releaseCanvas } from "./canvas";
import {
  orientationSwapsAxes,
  orientationTransform,
  readExifOrientation,
  type ExifOrientation,
} from "./exif";

export const MAX_MEGAPIXELS = 50;
export const MAX_BYTES = 40 * 1024 * 1024;

export const SUPPORTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export type IngestErrorCode =
  | "file-too-large"
  | "too-many-pixels"
  | "unsupported-type"
  | "decode-failed";

export class IngestError extends Error {
  constructor(
    readonly code: IngestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** EXIF orientation of the original; already applied to `bitmap`. */
  orientation: ExifOrientation;
}

export function isHeic(file: File | Blob): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // iOS sometimes hands over an empty MIME type; fall back to the extension.
  return type === "" && "name" in file
    ? /\.hei[cf]$/i.test((file as File).name)
    : false;
}

async function decodeHeic(file: Blob): Promise<Blob> {
  // Lazy, separate chunk: libheif is LGPL and must stay dynamically loaded (§6.4).
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
  return Array.isArray(converted) ? (converted[0] as Blob) : (converted as Blob);
}

export async function decodeImage(file: File | Blob): Promise<DecodedImage> {
  if (file.size > MAX_BYTES) {
    throw new IngestError(
      "file-too-large",
      `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please use a photo under ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }

  let source: Blob = file;
  if (isHeic(file)) {
    try {
      source = await decodeHeic(file);
    } catch (cause) {
      throw new IngestError(
        "decode-failed",
        "This HEIC photo could not be read. On iPhone, try Settings → Camera → Formats → Most Compatible, or export the photo as JPEG.",
      );
    }
  } else if (file.type && !SUPPORTED_MIME.includes(file.type.toLowerCase())) {
    throw new IngestError(
      "unsupported-type",
      `${file.type} isn't supported. Use a JPEG, PNG, WebP or HEIC photo.`,
    );
  }

  const orientation =
    source.type === "image/jpeg" ? await readExifOrientation(source) : 1;

  let bitmap: ImageBitmap;
  try {
    // Always decode unrotated and apply the transform ourselves. Engines
    // disagree about the default value of `imageOrientation` (the HTML spec
    // changed it to "from-image"), and guessing wrong either double-rotates or
    // never rotates. Explicit "none" is honoured everywhere the option exists,
    // and matches legacy behaviour where it doesn't.
    bitmap = await applyOrientation(
      await createImageBitmap(source, { imageOrientation: "none" }),
      orientation,
    );
  } catch (cause) {
    throw new IngestError(
      "decode-failed",
      "That image could not be opened. It may be corrupted or in an unsupported format.",
    );
  }

  const megapixels = (bitmap.width * bitmap.height) / 1_000_000;
  if (megapixels > MAX_MEGAPIXELS) {
    bitmap.close();
    throw new IngestError(
      "too-many-pixels",
      `That photo is ${megapixels.toFixed(0)} megapixels. Please use one under ${MAX_MEGAPIXELS} MP.`,
    );
  }

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    orientation,
  };
}

/** Bake the EXIF orientation into the pixels. No-op for orientation 1. */
async function applyOrientation(
  bitmap: ImageBitmap,
  orientation: ExifOrientation,
): Promise<ImageBitmap> {
  if (orientation === 1) return bitmap;
  const swap = orientationSwapsAxes(orientation);
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;

  const canvas = createCanvas(width, height);
  const ctx = get2d(canvas);
  ctx.setTransform(
    ...orientationTransform(orientation, bitmap.width, bitmap.height),
  );
  ctx.drawImage(bitmap, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bitmap.close();

  const rotated = await createImageBitmap(canvas as CanvasImageSource);
  releaseCanvas(canvas);
  return rotated;
}
