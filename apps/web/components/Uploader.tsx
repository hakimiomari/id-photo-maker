"use client";

import { useRef, useState } from "react";
import { usePhotoStore } from "../lib/store";

export function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const loadFile = usePhotoStore((s) => s.loadFile);
  const status = usePhotoStore((s) => s.status);
  const error = usePhotoStore((s) => s.error);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void loadFile(file);
  };

  return (
    <div className="space-y-3">
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
        className={`flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-surface"
        }`}
      >
        <p className="text-base font-medium">
          {status === "loading" ? "Reading your photo…" : "Add your photo"}
        </p>
        <p className="max-w-sm text-sm text-ink-muted">
          JPEG, PNG, WebP or HEIC. Face the camera, plain background, whole head
          visible with some space above it.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={status === "loading"}
          >
            Choose a photo
          </button>
          <button
            type="button"
            className="btn-secondary sm:hidden"
            onClick={() => cameraRef.current?.click()}
            disabled={status === "loading"}
          >
            Take a photo
          </button>
        </div>

        <p className="text-xs text-ink-faint">
          Your photo is processed on your device and never uploaded.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
          className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
