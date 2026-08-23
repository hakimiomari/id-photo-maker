/**
 * Typed worker protocol (§6.3). Bitmaps are transferred, never copied, and both
 * workers are restartable so a single crash cannot brick the session.
 */

import type {
  DetectedFace,
  FaceLandmarkerConfig,
  HeadBox,
  ImageAdjustments,
  ImageMetrics,
  PhotoFormat,
  Rect,
  Size,
} from "@photomaker/core";

export interface DetectFileRequest {
  id: number;
  type: "process";
  file: File;
  config: FaceLandmarkerConfig;
}

/**
 * Live camera frame (§4.7): landmarks only, no decode/downscale. The bitmap is
 * a downscaled grab of the video, transferred in and consumed.
 */
export interface DetectFrameRequest {
  id: number;
  type: "frame";
  bitmap: ImageBitmap;
  config: FaceLandmarkerConfig;
}

export type DetectRequest = DetectFileRequest | DetectFrameRequest;

export interface FrameSuccess {
  id: number;
  ok: true;
  kind: "frame";
  faces: DetectedFace[];
  /** Size of the frame the landmarks are normalized against. */
  size: Size;
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

export type DetectResponse = DetectSuccess | FrameSuccess | WorkerFailure;

export interface SegmentConfig {
  /** URL of the MODNet ONNX model. */
  modelUrl: string;
  /** Directory containing the onnxruntime-web .wasm/.mjs files. */
  ortBase: string;
}

export interface SegmentRequest {
  id: number;
  type: "segment";
  /** A *copy* of the working bitmap — transferred in and consumed. */
  bitmap: ImageBitmap;
  config: SegmentConfig;
}

export interface SegmentSuccess {
  id: number;
  ok: true;
  /** 8-bit alpha matte at the working copy's resolution. */
  mask: Uint8Array;
  width: number;
  height: number;
  backend: "webgpu" | "wasm";
  ms: number;
}

export type SegmentResponse = SegmentSuccess | WorkerFailure;

/**
 * Compliance pre-check pixel scan (§4.6). Measurements only — the verdicts are
 * derived on the main thread so a format change needs no rescan.
 */
export interface PrecheckRequest {
  id: number;
  type: "precheck";
  /** A *copy* of the working bitmap — transferred in and consumed. */
  bitmap: ImageBitmap;
  /** Face-mesh bounding box in working px. */
  face: Rect;
  head: HeadBox;
  /** Crop rectangle in working px; background is only judged inside it. */
  rect: Rect;
  /** Portrait matte at working resolution, when background removal has run. */
  mask?: Uint8Array;
  maskSize?: Size;
}

export interface PrecheckSuccess {
  id: number;
  ok: true;
  metrics: ImageMetrics;
  ms: number;
}

export type PrecheckResponse = PrecheckSuccess | WorkerFailure;

/** Matte payload attached to exports when background replacement is active. */
export interface MattePayload {
  /** Working-resolution alpha; upsampled bilinearly at render time (§5.3). */
  data: Uint8Array;
  width: number;
  height: number;
  /** Feather radius in working px (0–3); scaled to source res, min 1 px. */
  feather: number;
  fill: string;
}

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
  matte?: MattePayload;
}

export interface SheetRequest {
  id: number;
  type: "sheet";
  source: ImageBitmap;
  /** Crop rectangle in source pixels. */
  crop: Rect;
  format: PhotoFormat;
  paperId: string;
  dpi: number;
  output: "jpeg" | "pdf";
  adjustments?: ImageAdjustments;
  backgroundFill?: string;
  matte?: MattePayload;
}

/**
 * Family/batch sheet (§9): one sheet shared by several people. Photos arrive
 * as finished JPEGs (matte + adjustments already applied), one per member.
 */
export interface BatchSheetRequest {
  id: number;
  type: "batch-sheet";
  /** JPEG bytes per member, transferred. */
  photos: ArrayBuffer[];
  format: PhotoFormat;
  paperId: string;
  dpi: number;
  output: "jpeg" | "pdf";
}

export interface BatchSheetSuccess {
  id: number;
  ok: true;
  kind: "batch";
  blob: Blob;
  bytes: number;
  copies: number;
  perMember: number[];
  sheetWidth_mm: number;
  sheetHeight_mm: number;
}

export type BatchSheetResponse = BatchSheetSuccess | WorkerFailure;

export interface SheetSuccess {
  id: number;
  ok: true;
  blob: Blob;
  bytes: number;
  copies: number;
  /** Physical sheet size after orientation choice. */
  sheetWidth_mm: number;
  sheetHeight_mm: number;
  /** The source bitmap, handed back so the main thread keeps ownership. */
  source: ImageBitmap;
}

export type SheetResponse = SheetSuccess | WorkerFailure;

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
