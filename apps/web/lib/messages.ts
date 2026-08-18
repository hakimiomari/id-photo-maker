/**
 * Typed worker protocol (§6.3). Bitmaps are transferred, never copied, and both
 * workers are restartable so a single crash cannot brick the session.
 */

import type {
  DetectedFace,
  FaceLandmarkerConfig,
  ImageAdjustments,
  PhotoFormat,
  Rect,
  Size,
} from "@photomaker/core";

export interface DetectRequest {
  id: number;
  type: "process";
  file: File;
  config: FaceLandmarkerConfig;
}

export interface DetectSuccess {
  id: number;
  ok: true;
  /**
   * Full-resolution bitmap, kept for export. Always a distinct object from
   * `working`: export transfers this one, which would otherwise detach the
   * preview the editor is drawing.
   */
  source: ImageBitmap;
  working: ImageBitmap;
  workingSize: Size;
  sourceSize: Size;
  sourceScale: number;
  faces: DetectedFace[];
}

export interface WorkerFailure {
  id: number;
  ok: false;
  code: string;
  message: string;
  /**
   * Ownership of a transferred bitmap, handed back so a failed export does not
   * cost the user their loaded photo.
   */
  source?: ImageBitmap;
}

export type DetectResponse = DetectSuccess | WorkerFailure;

export interface EncodeRequest {
  id: number;
  type: "encode";
  source: ImageBitmap;
  /** Crop rectangle in source pixels. */
  crop: Rect;
  format: PhotoFormat;
  dpi: number;
  mimeType: "image/jpeg" | "image/png";
  quality?: number;
  adjustments?: ImageAdjustments;
  backgroundFill?: string;
  /** Digital-spec exports: exact pixel size and byte ceiling. */
  digital?: { width: number; height: number; maxBytes: number };
}

export interface EncodeSuccess {
  id: number;
  ok: true;
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  dpi: number;
  /** The source bitmap, handed back so the main thread keeps ownership. */
  source: ImageBitmap;
}

export type EncodeResponse = EncodeSuccess | WorkerFailure;
