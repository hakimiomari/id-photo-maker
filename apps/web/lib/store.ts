"use client";

import { create } from "zustand";
import {
  DEFAULT_FORMAT_ID,
  estimateHeadBounds,
  exportFilename,
  getFormat,
  IDENTITY_ADJUSTMENTS,
  NEUTRAL_ADJUSTMENTS,
  solveCrop,
  toSourceRect,
  type CropAdjustments,
  type CropSolution,
  type DetectedFace,
  type HeadBox,
  type ImageAdjustments,
  type PhotoFormat,
  type Size,
} from "@photomaker/core";
import { faceLandmarkerConfig } from "./config";
import type {
  DetectRequest,
  DetectResponse,
  EncodeRequest,
  EncodeResponse,
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
  kind: "print" | "digital";
}

interface PhotoState {
  formatId: string;
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

  /** Safe as methods — both return a stable reference or a primitive. */
  format: () => PhotoFormat;
  stage: () => Stage;

  setFormat: (id: string) => void;
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
  clearExport: () => void;
  reset: () => void;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

let detectClient: WorkerClient<DetectRequest, DetectResponse> | null = null;
let encodeClient: WorkerClient<EncodeRequest, EncodeResponse> | null = null;

function detectWorker() {
  detectClient ??= new WorkerClient<DetectRequest, DetectResponse>(
    () =>
      new Worker(new URL("../workers/detect.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return detectClient;
}

function encodeWorker() {
  encodeClient ??= new WorkerClient<EncodeRequest, EncodeResponse>(
    () =>
      new Worker(new URL("../workers/encode.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  return encodeClient;
}

/** Head geometry + crop solution for a given state. Pure; never throws. */
function derive(state: PhotoState): Pick<PhotoState, "head" | "solution"> {
  const face = state.faces[state.faceIndex];
  if (!face || !state.workingSize) return { head: null, solution: null };

  try {
    const head = estimateHeadBounds({
      landmarks: face.landmarks,
      image: state.workingSize,
    });
    const solution = solveCrop({
      head,
      format: getFormat(state.formatId),
      image: state.workingSize,
      adjust: state.adjust,
      sourceScale: state.sourceScale,
    });
    return { head, solution };
  } catch {
    // Degenerate landmarks (chin above crown) — the UI falls back to the
    // "no usable face" empty state rather than rendering a broken crop.
    return { head: null, solution: null };
  }
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

    format: () => getFormat(get().formatId),

    head: null,
    solution: null,

    stage: () => {
      const state = get();
      if (state.exportResult) return "download";
      if (state.status === "ready") return "adjust";
      if (state.status === "loading") return "photo";
      return "format";
    },

    setFormat: (id) => {
      getFormat(id); // throws early on a bad id rather than rendering nonsense
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

      setDerived({
        status: "loading",
        error: null,
        file,
        working: null,
        source: null,
        faces: [],
        faceIndex: 0,
        adjust: { ...IDENTITY_ADJUSTMENTS },
        exportResult: null,
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
        if (response.faces.length === 0) {
          response.working.close();
          response.source?.close();
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
          source: response.source ?? response.working,
          workingSize: response.workingSize,
          sourceScale: response.sourceScale,
          faces: response.faces,
          faceIndex: 0,
        });
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

    selectFace: (index) =>
      setDerived({ faceIndex: index, adjust: { ...IDENTITY_ADJUSTMENTS } }),

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

      const format = state.format();
      const digitalSpec = options.digital ? format.digital_spec : undefined;
      if (options.digital && !digitalSpec) return;

      const mimeType =
        digitalSpec?.format === "png"
          ? "image/png"
          : (options.mimeType ?? "image/jpeg");

      if (state.exportResult) URL.revokeObjectURL(state.exportResult.url);
      set({ exporting: true, error: null, exportResult: null });

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
      setDerived({
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
      });
    },
  };
});
