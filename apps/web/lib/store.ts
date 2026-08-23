"use client";

import { create } from "zustand";
import {
  BACKGROUND_FILLS,
  DEFAULT_FORMAT_ID,
  DEFAULT_PAPER_ID,
  estimateHeadBounds,
  evaluateCompliance,
  foregroundRatio,
  measurePose,
  refineCrownFromMask,
  exportFilename,
  getFormat,
  IDENTITY_ADJUSTMENTS,
  NEUTRAL_ADJUSTMENTS,
  solveCrop,
  toSourceRect,
  type ComplianceReport,
  type CropAdjustments,
  type CropSolution,
  type DetectedFace,
  type HeadBox,
  type ImageAdjustments,
  type ImageMetrics,
  type PhotoFormat,
  type PoseMetrics,
  type Size,
} from "@photomaker/core";
import { track } from "./analytics";
import { faceLandmarkerConfig, segmentConfig } from "./config";
import type { AttireTransform, RetouchOp } from "@photomaker/core";
import type {
  BatchSheetRequest,
  BatchSheetResponse,
  DetectRequest,
  DetectResponse,
  EncodeRequest,
  EncodeResponse,
  MattePayload,
  PrecheckRequest,
  PrecheckResponse,
  RetouchPayload,
  SegmentRequest,
  SegmentResponse,
  SheetRequest,
  SheetResponse,
} from "./messages";
import { WorkerClient } from "./workerClient";

export type Stage = "format" | "photo" | "adjust" | "download";

/** The app shell's navigation state: which step and which tool tab is open. */
export type ShellStep = "format" | "adjust" | "download";
export type AdjustTab = "crop" | "background" | "retouch";
export type DownloadTab = "photo" | "sheet" | "family";
export type Status = "idle" | "loading" | "ready" | "error";

export interface ExportResult {
  url: string;
  filename: string;
  bytes: number;
  width: number;
  height: number;
  dpi: number;
  kind: "print" | "digital" | "sheet" | "family";
  /** Sheet exports only: photos per sheet. */
  copies?: number;
  /** Family sheets only: photos per member, in member order. */
  perMember?: number[];
}

/** One person in the family batch (§9): their finished photo, ready to tile. */
export interface BatchMember {
  id: number;
  label: string;
  /** The final rendered JPEG — matte, fills and adjustments already baked in. */
  jpeg: ArrayBuffer;
  /** Small data-URL preview for the member list. */
  thumbUrl: string;
  formatId: string;
  /**
   * The person's original photo, kept so they can be reloaded into the
   * editor for further work (re-crop, retouch, different format…).
   */
  original: File | null;
}

interface PhotoState {
  formatId: string;
  paperId: string;
  status: Status;
  error: string | null;
  /** Failure code matching the worker/ingest error vocabulary — for localization. */
  errorCode: string | null;
  /** Kept so the pipeline can be re-run if a worker dies mid-session. */
  file: File | null;
  working: ImageBitmap | null;
  source: ImageBitmap | null;
  workingSize: Size | null;
  sourceScale: number;
  faces: DetectedFace[];
  faceIndex: number;
  adjust: CropAdjustments;
  image: ImageAdjustments;
  exporting: boolean;
  exportResult: ExportResult | null;

  /** Portrait matte at working resolution (§5.3); also refines the crown (§4.2.3). */
  mask: Uint8Array | null;
  maskSize: Size | null;
  segmenting: boolean;
  background: {
    /** Replacement colour; null = keep the original background. */
    fill: string | null;
    /** Edge feather 0–3 px at working resolution. */
    feather: number;
    /** Before/after toggle for the preview only. */
    showOriginal: boolean;
  };

  /**
   * Compliance pre-check (§4.6). `metrics` is the worker's pixel scan for the
   * selected face; pose comes straight from the landmarks. Both feed the
   * derived `compliance` report below.
   */
  metrics: ImageMetrics | null;
  metricsPending: boolean;

  /** Family batch (§9). Survives loadFile/reset — that is its whole purpose. */
  batch: BatchMember[];
  batchBusy: boolean;

  /**
   * Manual retouch (heal/smooth brushes, uploaded attire overlay). Only
   * offered on formats whose registry policy is "lenient" — biometric
   * documents reject digitally altered photos.
   */
  retouch: {
    tool: "none" | "heal" | "smooth" | "attire";
    ops: RetouchOp[];
    /** Brush radius in working px. */
    brushRadius: number;
    /** Smoothing strength, capped ≤ 0.7 so results stay natural. */
    smoothStrength: number;
    attire: {
      bytes: ArrayBuffer;
      bitmap: ImageBitmap;
      transform: AttireTransform;
    } | null;
  };

  /**
   * Derived state, recomputed once per change rather than per read.
   *
   * These must be stored values, not methods: zustand v5 runs the selector on
   * every getSnapshot, so a method returning a freshly built object hands React
   * a new identity each time and trips "The result of getSnapshot should be
   * cached to avoid an infinite loop".
   */
  head: HeadBox | null;
  solution: CropSolution | null;
  compliance: ComplianceReport | null;

  /** Shell navigation (§app-shell): one step and one tab visible at a time. */
  view: { step: ShellStep; adjustTab: AdjustTab; downloadTab: DownloadTab };

  /** Safe as methods — both return a stable reference or a primitive. */
  format: () => PhotoFormat;
  stage: () => Stage;

  setStep: (step: ShellStep) => void;
  setAdjustTab: (tab: AdjustTab) => void;
  setDownloadTab: (tab: DownloadTab) => void;
  setFormat: (id: string) => void;
  setPaper: (id: string) => void;
  loadFile: (file: File, origin?: "file" | "camera" | "sample") => Promise<void>;
  selectFace: (index: number) => void;
  pan: (dx: number, dy: number) => void;
  zoomBy: (factor: number) => void;
  setImageAdjustments: (adjustments: Partial<ImageAdjustments>) => void;
  resetAdjust: () => void;
  exportPhoto: (options?: {
    mimeType?: "image/jpeg" | "image/png";
    digital?: boolean;
  }) => Promise<void>;
  exportSheet: (output: "jpeg" | "pdf") => Promise<void>;
  addToBatch: () => Promise<void>;
  /** Reload a collected member into the editor (tap or drag-and-drop). */
  loadBatchMember: (id: number) => Promise<void>;
  removeBatchMember: (id: number) => void;
  clearBatch: () => void;
  exportFamilySheet: (output: "jpeg" | "pdf") => Promise<void>;
  setRetouchTool: (tool: "none" | "heal" | "smooth" | "attire") => void;
  addRetouchOp: (op: RetouchOp) => void;
  undoRetouch: () => void;
  clearRetouch: () => void;
  setBrushRadius: (radius: number) => void;
  setSmoothStrength: (strength: number) => void;
  setAttire: (file: File) => Promise<void>;
  setAttireTransform: (patch: Partial<AttireTransform>) => void;
  removeAttire: () => void;
  removeBackground: () => Promise<void>;
  clearBackground: () => void;
  /** Re-run the pixel scan for the selected face (automatic on load/face/mask changes). */
  runPrecheck: () => Promise<void>;
  setBackgroundFill: (fill: string) => void;
  setFeather: (feather: number) => void;
  toggleOriginal: () => void;
  clearExport: () => void;
  reset: () => void;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

let detectClient: WorkerClient<DetectRequest, DetectResponse> | null = null;
let encodeClient: WorkerClient<
  EncodeRequest | SheetRequest | BatchSheetRequest,
  EncodeResponse | SheetResponse | BatchSheetResponse
> | null = null;

function detectWorker() {
  detectClient ??= new WorkerClient<DetectRequest, DetectResponse>(
    () =>
      new Worker(new URL("../workers/detect.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return detectClient;
}

let segmentClient: WorkerClient<SegmentRequest, SegmentResponse> | null = null;

function segmentWorker() {
  segmentClient ??= new WorkerClient<SegmentRequest, SegmentResponse>(
    () =>
      new Worker(new URL("../workers/segment.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return segmentClient;
}

/**
 * Live camera guidance (§4.7): landmarks for one downscaled video frame. Shares
 * the detect worker (and its loaded model) with the file pipeline. The bitmap
 * is transferred and consumed. Resolves to [] when detection fails, so a
 * flaky frame never breaks the preview loop.
 */
export async function detectFrame(bitmap: ImageBitmap): Promise<DetectedFace[]> {
  try {
    const response = await detectWorker().send(
      { type: "frame", bitmap, config: faceLandmarkerConfig },
      [bitmap],
    );
    return response.ok && "kind" in response ? response.faces : [];
  } catch {
    detectWorker().terminate();
    return [];
  }
}

/** Drag payload type for family-sheet members (dropzone ↔ panels). */
export const MEMBER_DRAG_TYPE = "application/x-photomaker-member";

/** The fill a format's spec asks for; white when unregulated. */
export function requiredFill(background: PhotoFormat["background"]): string {
  return BACKGROUND_FILLS[background] ?? "#FFFFFF";
}

function encodeWorker() {
  encodeClient ??= new WorkerClient<
    EncodeRequest | SheetRequest | BatchSheetRequest,
    EncodeResponse | SheetResponse | BatchSheetResponse
  >(
    () =>
      new Worker(new URL("../workers/encode.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return encodeClient;
}

let precheckClient: WorkerClient<PrecheckRequest, PrecheckResponse> | null = null;

function precheckWorker() {
  precheckClient ??= new WorkerClient<PrecheckRequest, PrecheckResponse>(
    () =>
      new Worker(new URL("../workers/precheck.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return precheckClient;
}

/** Only the latest pixel scan may land; face switches mid-flight are dropped. */
let precheckSeq = 0;

let batchMemberSeq = 1;

/** Small data-URL preview of a finished member photo. */
async function makeThumb(jpeg: ArrayBuffer): Promise<string> {
  const bitmap = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
  const height = 96;
  const width = Math.round((bitmap.width / bitmap.height) * height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.75);
}

/** The colour the export will paint behind the subject, or null to keep it. */
function activeFill(state: PhotoState): string | null {
  return state.mask && state.background.fill ? state.background.fill : null;
}

/** Head geometry + crop solution + compliance report. Pure; never throws. */
function derive(
  state: PhotoState,
): Pick<PhotoState, "head" | "solution" | "compliance"> {
  const face = state.faces[state.faceIndex];
  if (!face || !state.workingSize) {
    return { head: null, solution: null, compliance: null };
  }

  let head: HeadBox | null = null;
  let solution: CropSolution | null = null;
  try {
    head = estimateHeadBounds({
      landmarks: face.landmarks,
      image: state.workingSize,
    });
    // §4.2.3: the topmost foreground pixel beats the hair-allowance heuristic.
    if (state.mask && state.maskSize) {
      head = refineCrownFromMask(head, state.mask, state.maskSize, state.workingSize);
    }
    solution = solveCrop({
      head,
      format: getFormat(state.formatId),
      image: state.workingSize,
      adjust: state.adjust,
      sourceScale: state.sourceScale,
    });
  } catch {
    // Degenerate landmarks (chin above crown) — the UI falls back to the
    // "no usable face" empty state rather than rendering a broken crop.
    return { head: null, solution: null, compliance: null };
  }

  // The pre-check is advisory, so it never takes the crop down with it.
  let pose: PoseMetrics | null = null;
  try {
    pose = measurePose({ landmarks: face.landmarks, image: state.workingSize });
  } catch {
    pose = null;
  }
  const compliance = evaluateCompliance({
    pose,
    image: state.metrics,
    format: getFormat(state.formatId),
    replacementFill: activeFill(state),
  });

  return { head, solution, compliance };
}

/** Matte payload for exports — a copy, so the preview keeps its mask. */
function buildMatte(state: PhotoState): MattePayload | null {
  if (!state.mask || !state.maskSize || !state.background.fill) return null;
  return {
    data: state.mask.slice(),
    width: state.maskSize.width,
    height: state.maskSize.height,
    feather: state.background.feather,
    fill: state.background.fill,
  };
}

/** Retouch payload for exports — copies, so the preview keeps its state. */
function buildRetouch(state: PhotoState): RetouchPayload | null {
  const { ops, attire } = state.retouch;
  if (ops.length === 0 && !attire) return null;
  return {
    ops: ops.map((op) =>
      op.kind === "heal" ? { ...op } : { ...op, points: op.points.slice() },
    ),
    scale: state.sourceScale,
    ...(attire
      ? {
          attire: {
            bytes: attire.bytes.slice(0),
            transform: { ...attire.transform },
          },
        }
      : {}),
  };
}

export const usePhotoStore = create<PhotoState>((set, get) => {
  /** set(), then recompute anything derived from the new state. */
  const setDerived = (
    partial: Partial<PhotoState> | ((state: PhotoState) => Partial<PhotoState>),
  ) =>
    set((state) => {
      const patch = typeof partial === "function" ? partial(state) : partial;
      return { ...patch, ...derive({ ...state, ...patch }) };
    });

  return {
    formatId: DEFAULT_FORMAT_ID,
    paperId: DEFAULT_PAPER_ID,
    status: "idle",
    error: null,
    errorCode: null,
    file: null,
    working: null,
    source: null,
    workingSize: null,
    sourceScale: 1,
    faces: [],
    faceIndex: 0,
    adjust: { ...IDENTITY_ADJUSTMENTS },
    image: { ...NEUTRAL_ADJUSTMENTS },
    exporting: false,
    exportResult: null,
    mask: null,
    maskSize: null,
    segmenting: false,
    background: { fill: null, feather: 1, showOriginal: false },
    metrics: null,
    metricsPending: false,
    batch: [],
    batchBusy: false,
    view: { step: "adjust", adjustTab: "crop", downloadTab: "photo" },
    retouch: {
      tool: "none",
      ops: [],
      brushRadius: 14,
      smoothStrength: 0.5,
      attire: null,
    },

    format: () => getFormat(get().formatId),

    head: null,
    solution: null,
    compliance: null,

    stage: () => {
      const state = get();
      if (state.exportResult) return "download";
      if (state.status === "ready") return "adjust";
      if (state.status === "loading") return "photo";
      return "format";
    },

    setStep: (step) => set((state) => ({ view: { ...state.view, step } })),

    setAdjustTab: (tab) =>
      set((state) => ({
        view: { ...state.view, step: "adjust", adjustTab: tab },
      })),

    setDownloadTab: (tab) =>
      set((state) => ({
        view: { ...state.view, step: "download", downloadTab: tab },
      })),

    setPaper: (id) => set({ paperId: id }),

    setFormat: (id) => {
      getFormat(id); // throws early on a bad id rather than rendering nonsense
      track("format_selected", { format: id });
      // Picking from the in-shell format view returns to Adjust; when no photo
      // is loaded yet this is a no-op the uploader never sees.
      set((state) =>
        state.status === "ready" && state.view.step === "format"
          ? { view: { ...state.view, step: "adjust" } }
          : {},
      );
      // Dropping a result must also release its object URL.
      const previousResult = get().exportResult;
      if (previousResult) URL.revokeObjectURL(previousResult.url);
      setDerived({
        formatId: id,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        exportResult: null,
      });
    },

    loadFile: async (file, origin = "file") => {
      const previous = get();
      previous.working?.close();
      if (previous.source && previous.source !== previous.working) {
        previous.source.close();
      }
      if (previous.exportResult) URL.revokeObjectURL(previous.exportResult.url);
      precheckSeq++; // a scan of the previous photo must not land on this one

      setDerived({
        status: "loading",
        error: null,
        errorCode: null,
        file,
        metrics: null,
        metricsPending: false,
        working: null,
        source: null,
        faces: [],
        faceIndex: 0,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        exportResult: null,
        mask: null,
        maskSize: null,
        background: { fill: null, feather: 1, showOriginal: false },
      });
      get().retouch.attire?.bitmap.close();
      set({
        retouch: { tool: "none", ops: [], brushRadius: 14, smoothStrength: 0.5, attire: null },
      });

      try {
        const response = await detectWorker().send({
          type: "process",
          file,
          config: faceLandmarkerConfig,
        });

        if (!response.ok) {
          set({ status: "error", error: response.message });
          return;
        }
        if (!("working" in response)) {
          // A frame response to a file request cannot happen by id; guard anyway.
          set({ status: "error", error: "Unexpected response from the detector." });
          return;
        }
        if (response.faces.length === 0) {
          response.working.close();
          response.source.close();
          set({
            status: "error",
            errorCode: "no-face",
            error:
              "No face found in that photo. Use a clear, front-facing portrait with the whole head visible.",
          });
          return;
        }

        track("photo_loaded", { source: origin });
        set({ view: { step: "adjust", adjustTab: "crop", downloadTab: "photo" } });
        setDerived({
          status: "ready",
          working: response.working,
          source: response.source,
          workingSize: response.workingSize,
          sourceScale: response.sourceScale,
          faces: response.faces,
          faceIndex: 0,
        });
        void get().runPrecheck();
      } catch (error) {
        detectWorker().terminate();
        set({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Something went wrong while processing that photo.",
        });
      }
    },

    selectFace: (index) => {
      // The old face's pixel metrics would be judged against the new face's
      // landmarks — drop them until the rescan lands.
      setDerived({
        faceIndex: index,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        metrics: null,
      });
      void get().runPrecheck();
    },

    runPrecheck: async () => {
      const state = get();
      const face = state.faces[state.faceIndex];
      if (!state.working || !state.workingSize || !face || !state.head || !state.solution) {
        return;
      }
      const seq = ++precheckSeq;
      set({ metricsPending: true });

      const { width, height } = state.workingSize;
      const faceRect = {
        x: face.bounds.x * width,
        y: face.bounds.y * height,
        width: face.bounds.width * width,
        height: face.bounds.height * height,
      };

      try {
        // Send a copy; the editor keeps drawing the original working bitmap.
        const copy = await createImageBitmap(state.working);
        const response = await precheckWorker().send(
          {
            type: "precheck",
            bitmap: copy,
            face: faceRect,
            head: state.head,
            rect: state.solution.rect,
            ...(state.mask && state.maskSize
              ? { mask: state.mask.slice(), maskSize: state.maskSize }
              : {}),
          },
          [copy],
        );
        if (seq !== precheckSeq) return; // superseded by a newer scan

        if (!response.ok) {
          // Advisory feature: fail quietly, the geometry checks still stand.
          set({ metricsPending: false });
          return;
        }
        setDerived({ metrics: response.metrics, metricsPending: false });
      } catch {
        precheckWorker().terminate();
        if (seq === precheckSeq) set({ metricsPending: false });
      }
    },

    pan: (dx, dy) =>
      setDerived((state) => ({
        adjust: {
          ...state.adjust,
          offsetX: state.adjust.offsetX + dx,
          offsetY: state.adjust.offsetY + dy,
        },
      })),

    zoomBy: (factor) =>
      setDerived((state) => ({
        adjust: {
          ...state.adjust,
          scale: Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, state.adjust.scale * factor),
          ),
        },
      })),

    setImageAdjustments: (adjustments) =>
      set((state) => ({ image: { ...state.image, ...adjustments } })),

    resetAdjust: () =>
      setDerived({
        adjust: { ...IDENTITY_ADJUSTMENTS },
        image: { ...NEUTRAL_ADJUSTMENTS },
      }),

    exportPhoto: async (options = {}) => {
      const state = get();
      const solution = state.solution;
      const source = state.source;
      if (!solution || !source) return;
      // The source bitmap is transferred into the encode worker and only comes
      // back with the response. A second export while one is in flight would
      // try to transfer an already-detached object and throw.
      if (state.exporting) return;

      const format = state.format();
      const digitalSpec = options.digital ? format.digital_spec : undefined;
      if (options.digital && !digitalSpec) return;

      const mimeType =
        digitalSpec?.format === "png"
          ? "image/png"
          : (options.mimeType ?? "image/jpeg");

      // Keep any previous result visible while the new one renders — removing
      // it here collapses the sidebar and makes the whole page jump.
      set({ exporting: true, error: null, errorCode: null });

      const matte = buildMatte(state);
      const retouchPayload = buildRetouch(state);

      try {
        // The bitmap is transferred into the worker and handed back with the
        // response, so the main thread never holds two copies.
        const response = await encodeWorker().send(
          {
            type: "encode",
            source,
            crop: toSourceRect(solution.rect, state.sourceScale),
            format,
            dpi: format.target_dpi,
            mimeType,
            adjustments: state.image,
            ...(matte ? { matte } : {}),
            ...(retouchPayload ? { retouch: retouchPayload } : {}),
            ...(digitalSpec
              ? {
                  digital: {
                    width: digitalSpec.width_px,
                    height: digitalSpec.height_px,
                    maxBytes: digitalSpec.max_bytes,
                  },
                }
              : {}),
          },
          [source],
        );

        if (!response.ok) {
          set({
            exporting: false,
            error: response.message,
          errorCode: response.code,
            source: response.source ?? null,
          });
          return;
        }
        if (!("width" in response)) return; // encode requests get encode responses

        const previous = get().exportResult;
        if (previous) URL.revokeObjectURL(previous.url);
        track("photo_exported", {
          kind: digitalSpec ? "digital" : "print",
          format: format.id,
        });
        set({
          exporting: false,
          source: response.source,
          exportResult: {
            url: URL.createObjectURL(response.blob),
            filename: exportFilename(
              format,
              mimeType,
              digitalSpec ? "digital" : undefined,
            ),
            bytes: response.bytes,
            width: response.width,
            height: response.height,
            dpi: response.dpi,
            kind: digitalSpec ? "digital" : "print",
          },
        });
      } catch (error) {
        encodeWorker().terminate();
        // The transferred bitmap died with the worker; the file is still here, so
        // the user can retry from the original.
        set({
          exporting: false,
          source: null,
          error:
            error instanceof Error
              ? `${error.message} Please re-select your photo and try again.`
              : "The export failed. Please try again.",
        });
      }
    },

    exportSheet: async (output) => {
      const state = get();
      const solution = state.solution;
      const source = state.source;
      if (!solution || !source) return;
      // Same transfer discipline as exportPhoto: one in-flight export at most.
      if (state.exporting) return;

      const format = state.format();
      // As in exportPhoto: leave the previous result in place until replaced.
      set({ exporting: true, error: null, errorCode: null });

      const matte = buildMatte(state);
      const retouchPayload = buildRetouch(state);

      try {
        const response = await encodeWorker().send(
          {
            type: "sheet",
            source,
            crop: toSourceRect(solution.rect, state.sourceScale),
            format,
            paperId: state.paperId,
            dpi: format.target_dpi,
            output,
            adjustments: state.image,
            ...(matte ? { matte } : {}),
            ...(retouchPayload ? { retouch: retouchPayload } : {}),
          },
          [source],
        );

        if (!response.ok) {
          set({
            exporting: false,
            error: response.message,
          errorCode: response.code,
            source: response.source ?? null,
          });
          return;
        }
        // Sheet responses carry the bitmap back; batch responses never do.
        if (!("copies" in response) || !("source" in response)) return;

        track("sheet_exported", {
          output,
          paper: state.paperId,
          format: format.id,
        });
        const previous = get().exportResult;
        if (previous) URL.revokeObjectURL(previous.url);
        const extension = output === "pdf" ? "pdf" : "jpg";
        set({
          exporting: false,
          source: response.source,
          exportResult: {
            url: URL.createObjectURL(response.blob),
            filename: `sheet-${format.id}-${state.paperId}-${response.copies}up.${extension}`,
            bytes: response.bytes,
            width: response.sheetWidth_mm,
            height: response.sheetHeight_mm,
            dpi: format.target_dpi,
            kind: "sheet",
            copies: response.copies,
          },
        });
      } catch (error) {
        encodeWorker().terminate();
        set({
          exporting: false,
          source: null,
          error:
            error instanceof Error
              ? `${error.message} Please re-select your photo and try again.`
              : "The sheet export failed. Please try again.",
        });
      }
    },

    addToBatch: async () => {
      const state = get();
      const solution = state.solution;
      const source = state.source;
      if (!solution || !source || state.exporting || state.batchBusy) return;

      const format = state.format();
      // One sheet, one cell size: every member must share the format.
      const first = state.batch[0];
      if (first && first.formatId !== format.id) {
        set({
          error: `This family sheet uses ${getFormat(first.formatId).label.en}. Switch back to that format, or clear the batch to start over.`,
        });
        return;
      }

      set({ batchBusy: true, exporting: true, error: null, errorCode: null });
      const matte = buildMatte(state);
      try {
        const response = await encodeWorker().send(
          {
            type: "encode",
            source,
            crop: toSourceRect(solution.rect, state.sourceScale),
            format,
            dpi: format.target_dpi,
            mimeType: "image/jpeg",
            adjustments: state.image,
            ...(matte ? { matte } : {}),
            ...(buildRetouch(state) ? { retouch: buildRetouch(state)! } : {}),
          },
          [source],
        );

        if (!response.ok) {
          set({
            batchBusy: false,
            exporting: false,
            error: response.message,
          errorCode: response.code,
            source: response.source ?? null,
          });
          return;
        }
        if (!("width" in response)) return;

        const jpeg = await response.blob.arrayBuffer();
        const member: BatchMember = {
          id: batchMemberSeq++,
          label: `Person ${get().batch.length + 1}`,
          jpeg,
          thumbUrl: await makeThumb(jpeg),
          formatId: format.id,
          original: get().file,
        };
        set((current) => ({
          batchBusy: false,
          exporting: false,
          source: response.source,
          batch: [...current.batch, member],
        }));
      } catch (error) {
        encodeWorker().terminate();
        set({
          batchBusy: false,
          exporting: false,
          source: null,
          error:
            error instanceof Error
              ? `${error.message} Please re-select your photo and try again.`
              : "Adding to the family sheet failed. Please try again.",
        });
      }
    },

    loadBatchMember: async (id) => {
      const member = get().batch.find((m) => m.id === id);
      if (!member) return;
      // Prefer the person's original photo (full re-editing freedom); fall
      // back to their rendered result.
      const file =
        member.original ??
        new File([member.jpeg], `${member.label}.jpg`, { type: "image/jpeg" });
      await get().loadFile(file);
    },

    removeBatchMember: (id) =>
      set((state) => ({
        batch: state.batch
          .filter((member) => member.id !== id)
          .map((member, index) => ({ ...member, label: `Person ${index + 1}` })),
      })),

    clearBatch: () => set({ batch: [] }),

    exportFamilySheet: async (output) => {
      const state = get();
      if (state.batch.length === 0 || state.batchBusy || state.exporting) return;

      const format = getFormat(state.batch[0]!.formatId);
      set({ batchBusy: true, error: null, errorCode: null });
      try {
        // Send copies; members stay reusable for the next paper size.
        const response = await encodeWorker().send({
          type: "batch-sheet",
          photos: state.batch.map((member) => member.jpeg.slice(0)),
          format,
          paperId: state.paperId,
          dpi: format.target_dpi,
          output,
        });

        if (!response.ok) {
          set({ batchBusy: false, error: response.message });
          return;
        }
        if (!("kind" in response) || response.kind !== "batch") return;

        track("family_sheet_exported", { output, people: state.batch.length });
        const previous = get().exportResult;
        if (previous) URL.revokeObjectURL(previous.url);
        const extension = output === "pdf" ? "pdf" : "jpg";
        set({
          batchBusy: false,
          exportResult: {
            url: URL.createObjectURL(response.blob),
            filename: `family-sheet-${format.id}-${state.paperId}-${state.batch.length}people.${extension}`,
            bytes: response.bytes,
            width: response.sheetWidth_mm,
            height: response.sheetHeight_mm,
            dpi: format.target_dpi,
            kind: "family",
            copies: response.copies,
            perMember: response.perMember,
          },
        });
      } catch (error) {
        encodeWorker().terminate();
        set({
          batchBusy: false,
          error:
            error instanceof Error
              ? error.message
              : "The family sheet export failed. Please try again.",
        });
      }
    },

    setRetouchTool: (tool) =>
      set((state) => ({ retouch: { ...state.retouch, tool } })),

    addRetouchOp: (op) =>
      set((state) => ({
        retouch: { ...state.retouch, ops: [...state.retouch.ops, op] },
      })),

    undoRetouch: () =>
      set((state) => ({
        retouch: { ...state.retouch, ops: state.retouch.ops.slice(0, -1) },
      })),

    clearRetouch: () => {
      get().retouch.attire?.bitmap.close();
      set((state) => ({
        retouch: { ...state.retouch, ops: [], attire: null, tool: "none" },
      }));
    },

    setBrushRadius: (radius) =>
      set((state) => ({ retouch: { ...state.retouch, brushRadius: radius } })),

    setSmoothStrength: (strength) =>
      set((state) => ({
        retouch: { ...state.retouch, smoothStrength: Math.min(0.7, strength) },
      })),

    setAttire: async (file) => {
      const state = get();
      if (!state.workingSize) return;
      try {
        const bytes = await file.arrayBuffer();
        const bitmap = await createImageBitmap(new Blob([bytes]));
        state.retouch.attire?.bitmap.close();
        // Anatomical default: centred on the face midline, hanging from just
        // below the chin, about a head wide — tie/collar territory that is
        // visible inside any format's crop. The user fine-tunes from there.
        const head = state.head;
        const headHeight = head ? head.yChin - head.yCrown : 0;
        const width = head
          ? (head.xRight - head.xLeft) * 1.2
          : state.workingSize.width * 0.5;
        const aspect = bitmap.height / bitmap.width;
        set((current) => ({
          retouch: {
            ...current.retouch,
            tool: "attire",
            attire: {
              bytes,
              bitmap,
              transform: {
                cx: head ? head.xMidline : current.workingSize!.width / 2,
                // Top edge just under the chin (5 % of head height) — a tie
                // knot sits at the collar, and tight formats crop barely a few
                // mm below the chin, so anything lower starts off-screen.
                cy: head
                  ? head.yChin + headHeight * 0.05 + (width * aspect) / 2
                  : current.workingSize!.height * 0.85,
                width,
                rotation: 0,
              },
            },
          },
        }));
      } catch {
        set({ error: "That image could not be opened.", errorCode: "decode-failed" });
      }
    },

    setAttireTransform: (patch) =>
      set((state) =>
        state.retouch.attire
          ? {
              retouch: {
                ...state.retouch,
                attire: {
                  ...state.retouch.attire,
                  transform: { ...state.retouch.attire.transform, ...patch },
                },
              },
            }
          : {},
      ),

    removeAttire: () => {
      get().retouch.attire?.bitmap.close();
      set((state) => ({
        retouch: {
          ...state.retouch,
          attire: null,
          tool: state.retouch.tool === "attire" ? "none" : state.retouch.tool,
        },
      }));
    },

    removeBackground: async () => {
      const state = get();
      if (!state.working || state.segmenting) return;
      set({ segmenting: true, error: null, errorCode: null });

      try {
        // Send a copy; the editor keeps drawing the original working bitmap.
        const copy = await createImageBitmap(state.working);
        const response = await segmentWorker().send(
          { type: "segment", bitmap: copy, config: segmentConfig },
          [copy],
        );

        if (!response.ok) {
          set({ segmenting: false, error: response.message });
          return;
        }
        if (foregroundRatio(response.mask) < 0.02) {
          set({
            segmenting: false,
            error:
              "No clear person outline was found — background removal works best with a single, well-lit subject.",
          });
          return;
        }

        track("background_removed", { backend: response.backend });
        // setDerived: the mask also refines the crown, which can change the
        // measured head height and therefore the validation verdict.
        setDerived({
          segmenting: false,
          mask: response.mask,
          maskSize: { width: response.width, height: response.height },
          background: {
            fill: requiredFill(get().format().background),
            feather: 1,
            showOriginal: false,
          },
        });
        // The matte makes the background measurement exact — rescan with it.
        void get().runPrecheck();
      } catch (error) {
        segmentWorker().terminate();
        set({
          segmenting: false,
          error:
            error instanceof Error
              ? error.message
              : "Background removal failed. Please try again.",
        });
      }
    },

    clearBackground: () => {
      setDerived({
        mask: null,
        maskSize: null,
        background: { fill: null, feather: 1, showOriginal: false },
      });
      void get().runPrecheck();
    },

    // setDerived: the background check reads the fill against the spec.
    setBackgroundFill: (fill) =>
      setDerived((state) => ({ background: { ...state.background, fill } })),

    setFeather: (feather) =>
      set((state) => ({ background: { ...state.background, feather } })),

    toggleOriginal: () =>
      set((state) => ({
        background: {
          ...state.background,
          showOriginal: !state.background.showOriginal,
        },
      })),

    clearExport: () => {
      const result = get().exportResult;
      if (result) URL.revokeObjectURL(result.url);
      set({ exportResult: null });
    },

    reset: () => {
      const state = get();
      state.working?.close();
      if (state.source && state.source !== state.working) state.source.close();
      if (state.exportResult) URL.revokeObjectURL(state.exportResult.url);
      precheckSeq++; // orphan any scan still in flight
      setDerived({
        metrics: null,
        metricsPending: false,
        status: "idle",
        error: null,
        file: null,
        working: null,
        source: null,
        workingSize: null,
        sourceScale: 1,
        faces: [],
        faceIndex: 0,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        image: { ...NEUTRAL_ADJUSTMENTS },
        exportResult: null,
        mask: null,
        maskSize: null,
        segmenting: false,
        background: { fill: null, feather: 1, showOriginal: false },
      });
      get().retouch.attire?.bitmap.close();
      set({
        retouch: { tool: "none", ops: [], brushRadius: 14, smoothStrength: 0.5, attire: null },
      });
    },
  };
});
