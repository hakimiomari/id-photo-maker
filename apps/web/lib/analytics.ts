"use client";

/**
 * Privacy-safe analytics (spec §7): cookieless, consentless-capable,
 * Plausible-compatible — and OFF unless NEXT_PUBLIC_ANALYTICS_DOMAIN is set.
 *
 * Hard rules, enforced by scripts/check-analytics.mjs in CI:
 *  - Only this file may talk to the analytics runtime (window.plausible).
 *  - Every event name and prop key is allowlisted below. Nothing derived from
 *    the user's photo — no image data, no dimensions, no coordinates, no
 *    biometrics — is ever a valid prop.
 *  - track() calls must use literal event names, so the allowlist is auditable
 *    by grep, not by trusting runtime behaviour.
 */

export const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? "";
export const ANALYTICS_SRC =
  process.env.NEXT_PUBLIC_ANALYTICS_SRC ?? "https://plausible.io/js/script.js";

/**
 * The complete event vocabulary. Props are closed enums or small integers —
 * never free text, never anything measured from the photo.
 */
export interface AnalyticsEvents {
  photo_loaded: { source: "file" | "camera" | "sample" };
  format_selected: { format: string };
  background_removed: { backend: "webgpu" | "wasm" };
  photo_exported: { kind: "print" | "digital"; format: string };
  sheet_exported: { output: "pdf" | "jpeg"; paper: string; format: string };
  family_sheet_exported: { output: "pdf" | "jpeg"; people: number };
}

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/** True when analytics is configured AND the user has not opted out. */
export function analyticsEnabled(): boolean {
  if (!ANALYTICS_DOMAIN) return false;
  if (typeof navigator === "undefined") return false;
  // Respect Do Not Track / Global Privacy Control even though Plausible is
  // cookieless — being the privacy-first option is the product's identity.
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return false;
  return true;
}

export function track<Name extends keyof AnalyticsEvents>(
  name: Name,
  props: AnalyticsEvents[Name],
): void {
  if (!analyticsEnabled()) return;
  try {
    window.plausible?.(name, { props });
  } catch {
    // Analytics must never break the app.
  }
}
