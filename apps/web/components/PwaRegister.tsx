"use client";

import { useEffect } from "react";

/**
 * Registers the service worker — production only. The dev server rewrites
 * modules constantly; a SW there serves stale chunks and produces exactly the
 * kind of silent, inert-page failure that is miserable to diagnose.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is progressive enhancement; the app works without it.
    });
  }, []);

  return null;
}
