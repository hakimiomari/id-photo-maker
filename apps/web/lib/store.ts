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
import { faceLandmarkerConfig, segmentConfig } from "./config";
import type {
  DetectRequest,
  DetectResponse,
  EncodeRequest,
  EncodeResponse,
  MattePayload,
  PrecheckRequest,
  PrecheckResponse,
  SegmentRequest,
  SegmentResponse,
  SheetRequest,
  SheetResponse,
} from "./messages";
import { WorkerClient } from "./workerClient";

export type Stage = "format" | "photo" | "adjust" | "download";
export type Status = "idle" | "loading" | "ready" | "error";

export interface ExportResult {
  url: string;
  filename: string;
  bytes: number;
  width: number;
  height: number;
  dpi: number;
  kind: "print" | "digital" | "sheet";
  /** Sheet exports only: photos per sheet. */
  copies?: number;
}

interface PhotoState {
  formatId: string;
  paperId: string;
  status: Status;
  error: string | null;
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

  /** Safe as methods — both return a stable reference or a primitive. */
  format: () => PhotoFormat;
  stage: () => Stage;

  setFormat: (id: string) => void;
  setPaper: (id: string) => void;
  loadFile: (file: File) => Promise<void>;
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
  EncodeRequest | SheetRequest,
  EncodeResponse | SheetResponse
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

/** The fill a format's spec asks for; white when unregulated. */
export function requiredFill(background: PhotoFormat["background"]): string {
  return BACKGROUND_FILLS[background] ?? "#FFFFFF";
}

function encodeWorker() {
  encodeClient ??= new WorkerClient<
    EncodeRequest | SheetRequest,
    EncodeResponse | SheetResponse
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

    setPaper: (id) => set({ paperId: id }),

    setFormat: (id) => {
      getFormat(id); // throws early on a bad id rather than rendering nonsense
      // Dropping a result must also release its object URL.
      const previousResult = get().exportResult;
      if (previousResult) URL.revokeObjectURL(previousResult.url);
      setDerived({
        formatId: id,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        exportResult: null,
      });
    },

    loadFile: async (file) => {
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
            error:
              "No face found in that photo. Use a clear, front-facing portrait with the whole head visible.",
          });
          return;
        }

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
      set({ exporting: true, error: null });

      const matte = buildMatte(state);

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
            source: response.source ?? null,
          });
          return;
        }
        if (!("width" in response)) return; // encode requests get encode responses

        const previous = get().exportResult;
        if (previous) URL.revokeObjectURL(previous.url);
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
      set({ exporting: true, error: null });

      const matte = buildMatte(state);

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
          },
          [source],
        );

        if (!response.ok) {
          set({
            exporting: false,
            error: response.message,
            source: response.source ?? null,
          });
          return;
        }
        if (!("copies" in response)) return; // sheet requests get sheet responses

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

    removeBackground: async () => {
      const state = get();
      if (!state.working || state.segmenting) return;
      set({ segmenting: true, error: null });

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
    },
  };
});
