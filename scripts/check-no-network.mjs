#!/usr/bin/env node
/**
 * Privacy CI gate (§7): the core library must never be able to send anything
 * anywhere. Fails the build if a network primitive appears in packages/core.
 *
 * The one allowance is model loading, which happens through MediaPipe's own
 * fetch inside the WASM runtime — our code only ever passes it URLs.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TARGETS = ["packages/core/src"];

const FORBIDDEN = [
  { pattern: /\bfetch\s*\(/, name: "fetch()" },
  { pattern: /XMLHttpRequest/, name: "XMLHttpRequest" },
  { pattern: /\bnew\s+WebSocket\b/, name: "WebSocket" },
  { pattern: /navigator\.sendBeacon/, name: "sendBeacon" },
  { pattern: /\bnew\s+EventSource\b/, name: "EventSource" },
  { pattern: /navigator\.clipboard/, name: "clipboard access" },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];
for (const target of TARGETS) {
  for (const file of walk(join(ROOT, target))) {
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, index) => {
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) {
        return;
      }
      for (const { pattern, name } of FORBIDDEN) {
        if (pattern.test(line)) {
          violations.push(
            `${relative(ROOT, file)}:${index + 1}  ${name}  →  ${line.trim()}`,
          );
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    "Privacy check failed: network primitives are not allowed in @photomaker/core.\n",
  );
  for (const violation of violations) console.error("  " + violation);
  console.error(
    "\nAll photo processing must stay on the device. If a model genuinely needs " +
      "loading, pass a URL to the caller instead of fetching here.",
  );
  process.exit(1);
}

console.log("Privacy check passed: no network primitives in @photomaker/core.");
