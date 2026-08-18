"use client";

import { useRef, useState } from "react";
import { usePhotoStore } from "../lib/store";
import { IconAlert, IconCamera, IconLock, IconUpload } from "./icons";

export function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const loadFile = usePhotoStore((s) => s.loadFile);
  const status = usePhotoStore((s) => s.status);
  const error = usePhotoStore((s) => s.error);
  const loading = status === "loading";

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void loadFile(file);
  };

  // Demo mode (§8.1): a bundled portrait through the exact same pipeline.
  const loadSample = async () => {
    try {
      const response = await fetch("/sample-portrait.jpg");
      const blob = await response.blob();
      await loadFile(
        new File([blob], "sample-portrait.jpg", { type: "image/jpeg" }),
      );
    } catch {
      // Same-origin fetch only fails offline before first cache — harmless.
    }
  };

  return (
    <div className="space-y-3">
      {/* Playwright's detection test dispatches its drop on `.border-dashed`. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ease-swift sm:min-h-[440px] ${
          dragging
            ? "border-accent bg-accent-soft/70 shadow-lift"
            : "border-line-strong bg-surface shadow-card"
        }`}
      >
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
            dragging ? "bg-accent text-white" : "bg-accent-soft text-accent"
          }`}
        >
          <IconUpload className="h-6 w-6" />
        </span>

        <div className="space-y-1.5">
          <p className="text-base font-semibold tracking-tight">
            {loading
              ? "Reading your photo…"
              : dragging
                ? "Drop it here"
                : "Add your photo"}
          </p>
          <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-ink-muted">
            JPEG, PNG, WebP or HEIC. Face the camera, plain background, whole
            head visible with some space above it.
          </p>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            className="btn-primary min-w-40"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <IconUpload className="h-4 w-4" />
            Choose a photo
          </button>
          <button
            type="button"
            className="btn-secondary sm:hidden"
            onClick={() => cameraRef.current?.click()}
            disabled={loading}
          >
            <IconCamera className="h-4 w-4" />
            Take a photo
          </button>
        </div>

        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => void loadSample()}
          disabled={loading}
        >
          No photo handy? Try a sample photo
        </button>

        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <IconLock className="h-3.5 w-3.5" />
          Your photo is processed on your device and never uploaded.
        </p>

        <input
          ref={inputRef}
          type="file"
          // Extensions as well as MIME types: macOS Finder and some Android
          // pickers grey out files whose extension they cannot map to a listed
          // type, which hides HEIC photos entirely. decodeImage() still rejects
          // anything unsupported with a friendly message.
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {status === "error" && error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-danger-border bg-danger-soft px-3.5 py-3 text-sm leading-relaxed text-danger"
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <IconAlert className="h-3 w-3" strokeWidth={2.5} />
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
