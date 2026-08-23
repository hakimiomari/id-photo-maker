#!/usr/bin/env node
/**
 * Analytics privacy gate (spec §7): no analytics event may include image data,
 * face coordinates, or derived biometrics — enforced, not promised.
 *
 * Rules checked over apps/web source:
 *  1. Only lib/analytics.ts may reference the analytics runtime (plausible).
 *  2. Every track() call uses a literal event name defined in AnalyticsEvents.
 *  3. No track() call's argument text mentions photo-derived identifiers
 *     (mask, landmark, bitmap, blob, head, crop, …) — props must be closed
 *     enums or counts, never measurements of the user's photo.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB = join(ROOT, "apps/web");
const ANALYTICS_FILE = join(WEB, "lib/analytics.ts");

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", "public"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];

// Rule 2 needs the allowlist: event names are the keys of AnalyticsEvents.
const analyticsSource = readFileSync(ANALYTICS_FILE, "utf8");
const interfaceBody = analyticsSource.match(
  /interface AnalyticsEvents \{([\s\S]*?)\n\}/,
)?.[1];
if (!interfaceBody) {
  console.error("check-analytics: could not parse AnalyticsEvents");
  process.exit(1);
}
const allowedEvents = new Set(
  [...interfaceBody.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
);

const FORBIDDEN_IN_PROPS =
  /\b(mask|landmark|bitmap|blob|head|crop|face|coord|pixel|metrics|pose|luminance|sharp|image|photo(?!_)|width|height|x|y)\s*[:,)]/i;

for (const file of walk(WEB)) {
  const source = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  // The runtime *call* is confined to analytics.ts; the loader in layout.tsx
  // only carries the script URL, which is fine.
  if (file !== ANALYTICS_FILE && /window\.plausible|\bplausible\s*\(/.test(source)) {
    violations.push(`${rel}: calls the analytics runtime directly`);
  }

  for (const match of source.matchAll(/\btrack(?:<[^>]*>)?\(\s*([^,)]*)/g)) {
    if (file === ANALYTICS_FILE) continue;
    const nameArg = (match[1] ?? "").trim();
    const literal = nameArg.match(/^["'](\w+)["']$/)?.[1];
    if (!literal) {
      violations.push(
        `${rel}: track() with a non-literal event name (${nameArg || "?"}) — the allowlist must stay greppable`,
      );
      continue;
    }
    if (!allowedEvents.has(literal)) {
      violations.push(`${rel}: track("${literal}") is not in AnalyticsEvents`);
    }
    // Extract exactly the call by walking balanced parentheses, so the scan
    // never bleeds into unrelated code after the call.
    let depth = 0;
    let end = match.index;
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const callText = source.slice(match.index, end);
    const hit = callText.match(FORBIDDEN_IN_PROPS);
    if (hit) {
      violations.push(
        `${rel}: track("${literal}") argument mentions "${hit[1]}" — props must never carry photo-derived data`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Analytics privacy check failed:\n");
  for (const violation of violations) console.error("  " + violation);
  console.error(
    "\nEvents may carry closed enums and small counts only (§7). " +
      "Add new events to AnalyticsEvents in apps/web/lib/analytics.ts.",
  );
  process.exit(1);
}

console.log(
  `Analytics privacy check passed: ${allowedEvents.size} allowlisted events, no photo-derived props.`,
);
