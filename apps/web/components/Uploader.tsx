"use client";

import { useEffect, useRef, useState } from "react";
import { cameraSupported } from "../lib/camera";
import { localizeError, useT } from "../lib/i18n";
import { MEMBER_DRAG_TYPE, usePhotoStore } from "../lib/store";
import { CameraCapture } from "./CameraCapture";
import { IconAlert, IconCamera, IconLock, IconUpload } from "./icons";

export function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Decided after mount: getUserMedia is a browser capability, and the server
  // render must not guess at it.
  const [inAppCamera, setInAppCamera] = useState(false);
  useEffect(() => setInAppCamera(cameraSupported()), []);
  const loadFile = usePhotoStore((s) => s.loadFile);
  const status = usePhotoStore((s) => s.status);
  const error = usePhotoStore((s) => s.error);
  const batch = usePhotoStore((s) => s.batch);
  const loadBatchMember = usePhotoStore((s) => s.loadBatchMember);
  const errorCode = usePhotoStore((s) => s.errorCode);
  const { t } = useT();
  const loading = status === "loading";

  if (cameraOpen) {
    return <CameraCapture onClose={() => setCameraOpen(false)} />;
  }

  // In-app camera (§4.7) when the browser can stream; the native camera app
  // (file input with capture) as the phone fallback otherwise.
  const openCamera = () =>
    inAppCamera ? setCameraOpen(true) : cameraRef.current?.click();

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
        "sample",
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
          // A family-sheet member dragged in beats a file drop.
          const memberId = event.dataTransfer.getData(MEMBER_DRAG_TYPE);
          if (memberId) {
            void loadBatchMember(Number(memberId));
            return;
          }
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
            dragging ? "bg-accent text-surface" : "bg-accent-soft text-accent"
          }`}
        >
          <IconUpload className="h-6 w-6" />
        </span>

        <div className="space-y-1.5">
          <p className="text-base font-semibold tracking-tight">
            {loading ? t.uploader.reading : dragging ? t.uploader.drop : t.uploader.title}
          </p>
          <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-ink-muted">
            {t.uploader.formats}
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
            {t.uploader.choose}
          </button>
          <button
            type="button"
            className={inAppCamera ? "btn-secondary" : "btn-secondary sm:hidden"}
            onClick={openCamera}
            disabled={loading}
          >
            <IconCamera className="h-4 w-4" />
            {t.uploader.take}
          </button>
        </div>

        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => void loadSample()}
          disabled={loading}
        >
          {t.uploader.sample}
        </button>

        {batch.length > 0 && (
          <div className="mt-1 w-full max-w-sm rounded-control border border-line bg-canvas p-3">
            <p className="mb-2 text-xs font-medium text-ink-muted">
              {t.uploader.fromBatch}
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {batch.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={loading}
                    aria-label={member.label}
                    title={member.label}
                    onClick={() => void loadBatchMember(member.id)}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(MEMBER_DRAG_TYPE, String(member.id));
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    className="group flex cursor-grab flex-col items-center gap-1 active:cursor-grabbing"
                  >
                    <img
                      src={member.thumbUrl}
                      alt=""
                      className="h-14 w-auto rounded-[5px] border border-line-strong transition-transform duration-150 group-hover:scale-105"
                    />
                    <span className="text-[11px] text-ink-faint">{member.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <IconLock className="h-3.5 w-3.5" />
          {t.uploader.privacy}
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
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-surface">
            <IconAlert className="h-3 w-3" strokeWidth={2.5} />
          </span>
          {localizeError(errorCode, error, t)}
        </p>
      )}
    </div>
  );
}
