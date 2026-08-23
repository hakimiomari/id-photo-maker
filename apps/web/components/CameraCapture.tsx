"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  alignmentGuide,
  assessFrame,
  estimateHeadBounds,
  measurePose,
  type CaptureGuidance,
  type GuidanceCode,
  type HeadBox,
  type PoseMetrics,
  type Size,
} from "@photomaker/core";
import {
  capturePhoto,
  closeCamera,
  grabFrame,
  hasMultipleCameras,
  openCamera,
  type CameraSession,
  type FacingMode,
} from "../lib/camera";
import { detectFrame, usePhotoStore } from "../lib/store";
import { IconAlert, IconCamera, IconLock, IconSwitchCamera, IconX } from "./icons";

/** Detection frames are downscaled to this width: fast, and plenty for landmarks. */
const DETECT_WIDTH = 480;
/** Minimum gap between detection passes, ms. */
const DETECT_INTERVAL = 150;
const COUNTDOWN_SECONDS = 3;

const HINTS: Record<GuidanceCode, string> = {
  "no-face": "Position your face inside the oval",
  closer: "Move closer",
  back: "Move back a little",
  centre: "Centre your face in the frame",
  "space-above": "Leave more space above your head",
  "move-up": "Move up — your chin is too close to the bottom edge",
  straighten: "Keep your head straight",
  "face-camera": "Look straight at the camera",
  "open-eyes": "Open your eyes",
  "close-mouth": "Close your mouth — neutral expression",
  good: "Looking good — hold still",
};

const GUIDE_COLOUR = "rgba(255, 255, 255, 0.55)";
const GOOD_COLOUR = "rgba(52, 211, 153, 0.95)";
const ADJUST_COLOUR = "rgba(251, 191, 36, 0.95)";

interface Props {
  onClose: () => void;
}

/**
 * In-app camera (§4.7): live preview with the format's alignment guide, real-
 * time hints from the face mesh, and a countdown capture that feeds the same
 * pipeline as an uploaded file. The stream never leaves the page.
 */
export function CameraCapture({ onClose }: Props) {
  const format = usePhotoStore((s) => s.format());
  const loadFile = usePhotoStore((s) => s.loadFile);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);

  const [facing, setFacing] = useState<FacingMode>("user");
  const [mirrored, setMirrored] = useState(true);
  const [canSwitch, setCanSwitch] = useState(false);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState<Size | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [guidance, setGuidance] = useState<CaptureGuidance | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  // --- camera lifecycle ----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setOpening(true);
    setError(null);
    setFrameSize(null);
    setGuidance(null);

    (async () => {
      try {
        const session = await openCamera(facing);
        if (cancelled) {
          closeCamera(session);
          return;
        }
        sessionRef.current = session;
        setMirrored(session.mirrored);
        const video = videoRef.current;
        if (video) {
          video.srcObject = session.stream;
          await video.play().catch(() => undefined);
        }
        setOpening(false);
        void hasMultipleCameras().then((multiple) => {
          if (!cancelled) setCanSwitch(multiple);
        });
      } catch (err) {
        if (cancelled) return;
        setOpening(false);
        setError(err instanceof Error ? err.message : "The camera could not be started.");
      }
    })();

    return () => {
      cancelled = true;
      closeCamera(sessionRef.current);
      sessionRef.current = null;
    };
  }, [facing]);

  const onVideoReady = () => {
    const video = videoRef.current;
    if (video?.videoWidth && video.videoHeight) {
      setFrameSize({ width: video.videoWidth, height: video.videoHeight });
    }
  };

  // --- live detection loop --------------------------------------------------
  /** Size of the downscaled frame the current guidance was measured on. */
  const detectSizeRef = useRef<Size | null>(null);
  useEffect(() => {
    if (!frameSize || capturing || error) return;
    let cancelled = false;

    const tick = async () => {
      while (!cancelled) {
        const started = performance.now();
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const bitmap = await grabFrame(video, DETECT_WIDTH);
          if (cancelled) {
            bitmap?.close();
            return;
          }
          if (bitmap) {
            const size: Size = { width: bitmap.width, height: bitmap.height };
            const faces = await detectFrame(bitmap);
            if (cancelled) return;
            const face = faces[0];
            let head: HeadBox | null = null;
            let pose: PoseMetrics | null = null;
            if (face) {
              try {
                head = estimateHeadBounds({ landmarks: face.landmarks, image: size });
                pose = measurePose({ landmarks: face.landmarks, image: size });
              } catch {
                head = null;
              }
            }
            const next = assessFrame({ head, pose, format, frame: size });
            detectSizeRef.current = size;
            setGuidance(next);
          }
        }
        const wait = DETECT_INTERVAL - (performance.now() - started);
        await new Promise((r) => setTimeout(r, Math.max(16, wait)));
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [frameSize, format, capturing, error]);

  // --- overlay ---------------------------------------------------------------
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameSize || area.width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(area.width * dpr);
    canvas.height = Math.round(area.height * dpr);
    canvas.style.width = `${area.width}px`;
    canvas.style.height = `${area.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, area.width, area.height);

    // The video is object-fit: contain — find its box inside the container.
    const k = Math.min(area.width / frameSize.width, area.height / frameSize.height);
    const dw = frameSize.width * k;
    const dh = frameSize.height * k;
    const ox = (area.width - dw) / 2;
    const oy = (area.height - dh) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    // Mirror the overlay the same way the preview is mirrored, so the live
    // frame sits on the face the user sees.
    if (mirrored) {
      ctx.translate(dw, 0);
      ctx.scale(-1, 1);
    }
    ctx.scale(k, k);

    // Static guide: crop outline + head oval, in frame px.
    const guide = alignmentGuide(format, frameSize);
    ctx.lineWidth = 1.5 / k;
    ctx.strokeStyle = GUIDE_COLOUR;
    ctx.setLineDash([8 / k, 6 / k]);
    ctx.strokeRect(guide.crop.x, guide.crop.y, guide.crop.width, guide.crop.height);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(
      guide.head.x + guide.head.width / 2,
      guide.head.y + guide.head.height / 2,
      guide.head.width / 2,
      guide.head.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    // Live crop: where the solver would cut on this frame. Detection ran on a
    // downscaled frame, so scale its rect up to the video's pixels.
    const live = guidance;
    const detected = detectSizeRef.current;
    if (live?.rect && live.status !== "no-face" && detected) {
      const rect = live.rect;
      const scale = frameSize.width / detected.width;
      ctx.lineWidth = 2.5 / k;
      ctx.strokeStyle = live.status === "good" ? GOOD_COLOUR : ADJUST_COLOUR;
      ctx.strokeRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
    }
    ctx.restore();
  }, [area, frameSize, format, guidance, mirrored]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  // --- capture -----------------------------------------------------------------
  const capture = useCallback(async () => {
    const video = videoRef.current;
    const session = sessionRef.current;
    if (!video || !session) return;
    setCapturing(true);
    try {
      const file = await capturePhoto(video, session.track);
      void loadFile(file);
      onClose();
    } catch (err) {
      setCapturing(false);
      setError(err instanceof Error ? err.message : "Could not take the photo.");
    }
  }, [loadFile, onClose]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void capture();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, capture]);

  const startCountdown = () => {
    if (countdown !== null || capturing || opening || error) return;
    setCountdown(COUNTDOWN_SECONDS);
  };

  const ready = !opening && !error && !!frameSize;
  const hint = guidance ? HINTS[guidance.code] : "Looking for your face…";
  const hintTone =
    guidance?.status === "good"
      ? "border-ok-border bg-ok-soft text-ok"
      : guidance?.status === "adjust"
        ? "border-warn-border bg-warn-soft text-warn"
        : "border-line bg-surface text-ink-muted";

  return (
    <div className="space-y-3" data-testid="camera-capture">
      <div
        ref={containerRef}
        className="relative h-[52vh] min-h-[320px] w-full overflow-hidden rounded-card bg-black shadow-card ring-1 ring-line sm:h-[62vh]"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={onVideoReady}
          onResize={onVideoReady}
          className="h-full w-full object-contain"
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        />
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {countdown !== null && countdown > 0 && (
          <div
            aria-live="assertive"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="rounded-full bg-black/55 px-8 py-4 text-6xl font-semibold tabular-nums text-white">
              {countdown}
            </span>
          </div>
        )}

        {(opening || capturing) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white">
            {capturing ? "Taking the photo…" : "Starting camera…"}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p
              role="alert"
              className="flex max-w-sm items-start gap-2.5 rounded-control border border-danger-border bg-danger-soft px-3.5 py-3 text-sm leading-relaxed text-danger"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-surface">
                <IconAlert className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {error}
            </p>
          </div>
        )}

        {ready && (
          <p
            role="status"
            aria-live="polite"
            className={`absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-control border px-3.5 py-2 text-center text-sm font-medium ${hintTone}`}
          >
            {hint}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary min-w-40"
            onClick={startCountdown}
            disabled={!ready || countdown !== null || capturing}
          >
            <IconCamera className="h-4 w-4" />
            {countdown !== null ? `Taking photo in ${countdown}…` : `Take photo (${COUNTDOWN_SECONDS} s timer)`}
          </button>
          {canSwitch && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setFacing(facing === "user" ? "environment" : "user")}
              disabled={countdown !== null || capturing}
            >
              <IconSwitchCamera className="h-4 w-4" />
              Switch camera
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose} disabled={capturing}>
            <IconX className="h-4 w-4" />
            Cancel
          </button>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <IconLock className="h-3.5 w-3.5" />
          Live video stays on your device
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Plain, evenly lit wall behind you · light on your face, not behind you ·
        camera at eye level · glasses off if you can.
      </p>
    </div>
  );
}

