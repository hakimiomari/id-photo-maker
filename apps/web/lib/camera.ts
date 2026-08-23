/**
 * Camera access for in-app capture (§4.7). Thin wrappers over getUserMedia so
 * the component stays about UI. The stream is local to the page — nothing is
 * recorded or sent — and every path that hands out a stream has a matching
 * close.
 */

export type FacingMode = "user" | "environment";

export type CameraErrorCode =
  | "unsupported"
  | "denied"
  | "not-found"
  | "in-use"
  | "unknown";

export class CameraError extends Error {
  constructor(
    public readonly code: CameraErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CameraError";
  }
}

export interface CameraSession {
  stream: MediaStream;
  track: MediaStreamTrack;
  /** What the camera reports, falling back to what was requested. */
  facingMode: FacingMode;
  /** Front cameras are previewed mirrored, like a mirror; captures never are. */
  mirrored: boolean;
}

export function cameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    (window.isSecureContext ?? true)
  );
}

const MESSAGES: Record<CameraErrorCode, string> = {
  unsupported:
    "This browser can't open the camera here. Upload a photo instead, or use your phone's camera app.",
  denied:
    "Camera access was blocked. Allow it in your browser's site settings, or upload a photo instead.",
  "not-found": "No camera was found on this device.",
  "in-use": "The camera is already in use by another app or tab.",
  unknown: "The camera could not be started. Please try again or upload a photo.",
};

function toCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : "";
  const code: CameraErrorCode =
    name === "NotAllowedError" || name === "SecurityError"
      ? "denied"
      : name === "NotFoundError" || name === "OverconstrainedError"
        ? "not-found"
        : name === "NotReadableError" || name === "AbortError"
          ? "in-use"
          : "unknown";
  return new CameraError(code, MESSAGES[code]);
}

/**
 * Open the camera, asking for the highest resolution it offers. `ideal`
 * constraints never fail — the browser just gives what it has.
 */
export async function openCamera(facing: FacingMode): Promise<CameraSession> {
  if (!cameraSupported()) {
    throw new CameraError("unsupported", MESSAGES.unsupported);
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: 4096 },
        height: { ideal: 4096 },
      },
    });
  } catch (error) {
    throw toCameraError(error);
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new CameraError("not-found", MESSAGES["not-found"]);
  }
  const reported = track.getSettings().facingMode;
  const facingMode: FacingMode = reported === "environment" ? "environment" : reported === "user" ? "user" : facing;
  return { stream, track, facingMode, mirrored: facingMode === "user" };
}

export function closeCamera(session: CameraSession | null): void {
  session?.stream.getTracks().forEach((track) => track.stop());
}

/** More than one camera → offer a switch button. Best effort; false on error. */
export async function hasMultipleCameras(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length > 1;
  } catch {
    return false;
  }
}

/** Downscaled copy of the current video frame for live detection. */
export async function grabFrame(
  video: HTMLVideoElement,
  maxWidth: number,
): Promise<ImageBitmap | null> {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  const scale = Math.min(1, maxWidth / videoWidth);
  const width = Math.round(videoWidth * scale);
  const height = Math.round(videoHeight * scale);
  // Drawing through a canvas works everywhere; createImageBitmap(video, {resize})
  // does not on older Safari.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const bitmap = await createImageBitmap(canvas);
  canvas.width = 0;
  canvas.height = 0;
  return bitmap;
}

interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
  getPhotoCapabilities(): Promise<{ imageWidth?: { max?: number } }>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Capture a full-resolution still, never mirrored. Uses the ImageCapture API
 * when it can deliver more pixels than the video stream (phones), otherwise
 * grabs the current frame off the video element.
 */
export async function capturePhoto(
  video: HTMLVideoElement,
  track: MediaStreamTrack,
): Promise<File> {
  const ImageCaptureCtor = (
    globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }
  ).ImageCapture;

  if (ImageCaptureCtor) {
    try {
      const capture = new ImageCaptureCtor(track);
      const caps = await withTimeout(capture.getPhotoCapabilities(), 1500);
      if ((caps.imageWidth?.max ?? 0) > video.videoWidth) {
        const blob = await withTimeout(capture.takePhoto(), 5000);
        const ext = blob.type === "image/png" ? "png" : "jpg";
        return new File([blob], `camera-${stamp()}.${ext}`, {
          type: blob.type || "image/jpeg",
        });
      }
    } catch {
      // Fall through to the frame grab — ImageCapture is flaky on desktops.
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CameraError("unknown", MESSAGES.unknown);
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new CameraError("unknown", MESSAGES.unknown))),
      "image/jpeg",
      0.95,
    ),
  );
  canvas.width = 0;
  canvas.height = 0;
  return new File([blob], `camera-${stamp()}.jpg`, { type: "image/jpeg" });
}
