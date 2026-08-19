"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { composeWithMatte, releaseCanvas } from "@photomaker/core";
import { usePhotoStore } from "../lib/store";
import {
  computeFrame,
  drawFrame,
  drawOverlay,
  OVERLAY_DARK,
  OVERLAY_LIGHT,
} from "../lib/overlay";

const KEY_PAN = 4;
const KEY_PAN_FAST = 16;
const KEY_ZOOM = 1.03;

/**
 * The crop canvas: a fixed frame with the photo moving underneath it. Every
 * gesture updates the solver's adjustment deltas, and the solver re-validates
 * on each animation frame (§4.5).
 */
export function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });

  const working = usePhotoStore((s) => s.working);
  const image = usePhotoStore((s) => s.image);
  const mask = usePhotoStore((s) => s.mask);
  const background = usePhotoStore((s) => s.background);
  // One subscription for the whole crop: `solution` is recomputed (and gets a
  // new identity) on every pan, zoom, format change and face change.
  const solution = usePhotoStore((s) => s.solution);
  const pan = usePhotoStore((s) => s.pan);
  const zoomBy = usePhotoStore((s) => s.zoomBy);

  // Cut-out of the working bitmap through the matte, rebuilt when the mask or
  // feather changes. Kept as an ImageBitmap so draw() stays cheap per frame.
  const cutoutRef = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    let cancelled = false;
    const state = usePhotoStore.getState();
    cutoutRef.current?.close();
    cutoutRef.current = null;
    if (mask && state.maskSize && working) {
      const composed = composeWithMatte(working, {
        mask,
        maskSize: state.maskSize,
        fill: null,
        feather: background.feather,
      });
      void createImageBitmap(composed as unknown as ImageBitmapSource).then(
        (bitmap) => {
          releaseCanvas(composed);
          if (cancelled) return bitmap.close();
          cutoutRef.current = bitmap;
          requestAnimationFrame(draw);
        },
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mask, background.feather, working]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setArea({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state = usePhotoStore.getState();
    const { solution, head } = state;
    if (!canvas || !state.working || !solution || !head || area.width === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(area.width * dpr);
    canvas.height = Math.round(area.height * dpr);
    canvas.style.width = `${area.width}px`;
    canvas.style.height = `${area.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, area.width, area.height);

    const format = state.format();
    const frame = computeFrame(area, format);
    const k = frame.width / solution.rect.width;

    const imgX = frame.x - solution.rect.x * k;
    const imgY = frame.y - solution.rect.y * k;
    const imgW = state.working.width * k;
    const imgH = state.working.height * k;

    ctx.save();
    ctx.filter = filterOf(state.image);
    ctx.imageSmoothingQuality = "high";
    const cutout = cutoutRef.current;
    const replaceBg =
      cutout && state.background.fill && !state.background.showOriginal;
    if (replaceBg) {
      // Background replacement preview: fill first, then the matted subject.
      ctx.filter = "none";
      ctx.fillStyle = state.background.fill!;
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.filter = filterOf(state.image);
      ctx.drawImage(cutout, imgX, imgY, imgW, imgH);
    } else {
      ctx.drawImage(state.working, imgX, imgY, imgW, imgH);
    }
    ctx.restore();

    const palette = document.documentElement.classList.contains("dark")
      ? OVERLAY_DARK
      : OVERLAY_LIGHT;
    drawFrame(ctx, frame, area, palette);
    drawOverlay({ ctx, frame, format, solution, head, k, palette });
  }, [area]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw, working, solution, image, mask, background]);

  // The guides are canvas paint, not CSS — repaint when the theme flips.
  useEffect(() => {
    const onTheme = () => requestAnimationFrame(draw);
    window.addEventListener("themechange", onTheme);
    return () => window.removeEventListener("themechange", onTheme);
  }, [draw]);

  // --- gestures -----------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);

  const scaleOf = useCallback(() => {
    const state = usePhotoStore.getState();
    const solution = state.solution;
    if (!solution || area.width === 0) return 1;
    return computeFrame(area, state.format()).width / solution.rect.width;
  }, [area]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current !== null && pinchDistance.current > 0) {
        zoomBy(distance / pinchDistance.current);
      }
      pinchDistance.current = distance;
      return;
    }

    // Dragging the photo one way moves the crop window the other way.
    const k = scaleOf();
    pan(
      -(event.clientX - previous.x) / k,
      -(event.clientY - previous.y) / k,
    );
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (event.deltaY === 0) return;
    zoomBy(event.deltaY < 0 ? 1.06 : 1 / 1.06);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = event.shiftKey ? KEY_PAN_FAST : KEY_PAN;
    const k = scaleOf();
    switch (event.key) {
      case "ArrowLeft":
        pan(-step / k, 0);
        break;
      case "ArrowRight":
        pan(step / k, 0);
        break;
      case "ArrowUp":
        pan(0, -step / k);
        break;
      case "ArrowDown":
        pan(0, step / k);
        break;
      case "+":
      case "=":
        zoomBy(KEY_ZOOM);
        break;
      case "-":
      case "_":
        zoomBy(1 / KEY_ZOOM);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[52vh] min-h-[320px] w-full overflow-hidden rounded-card bg-editor shadow-card ring-1 ring-line sm:h-[62vh]"
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Crop area. Use the arrow keys to move the photo and plus or minus to zoom."
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      />
      <FacePicker />
    </div>
  );
}

function FacePicker() {
  const faces = usePhotoStore((s) => s.faces);
  const faceIndex = usePhotoStore((s) => s.faceIndex);
  const selectFace = usePhotoStore((s) => s.selectFace);
  if (faces.length < 2) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface/90 p-2.5 text-xs backdrop-blur-sm">
      <span className="font-medium text-ink-muted">
        {faces.length} faces found — pick the subject:
      </span>
      {faces.map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => selectFace(index)}
          className={`rounded-control px-3 py-1.5 font-medium transition-colors duration-150 ${
            index === faceIndex
              ? "bg-accent text-surface"
              : "border border-line-strong bg-surface text-ink hover:bg-canvas"
          }`}
        >
          Face {index + 1}
        </button>
      ))}
    </div>
  );
}

function filterOf(image: { brightness: number; contrast: number; saturation: number }) {
  const parts: string[] = [];
  if (image.brightness !== 1) parts.push(`brightness(${image.brightness})`);
  if (image.contrast !== 1) parts.push(`contrast(${image.contrast})`);
  if (image.saturation !== 1) parts.push(`saturate(${image.saturation})`);
  return parts.length ? parts.join(" ") : "none";
}
