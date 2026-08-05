"use client";

import { useMemo, useState } from "react";
import {
  FORMATS,
  formatDimensions,
  formatLabel,
  searchFormats,
  type FormatCategory,
  type PhotoFormat,
} from "@photomaker/core";
import { usePhotoStore } from "../lib/store";

const CATEGORY_LABEL: Record<FormatCategory, string> = {
  generic: "Common sizes",
  passport: "Passports",
  visa: "Visas",
  license: "Driving licences",
  other: "Other",
};

const CATEGORY_ORDER: FormatCategory[] = [
  "generic",
  "passport",
  "visa",
  "license",
  "other",
];

export function FormatPicker() {
  const [query, setQuery] = useState("");
  const formatId = usePhotoStore((s) => s.formatId);
  const setFormat = usePhotoStore((s) => s.setFormat);

  const groups = useMemo(() => {
    const matches = query ? searchFormats(query) : [...FORMATS];
    const byCategory = new Map<FormatCategory, PhotoFormat[]>();
    for (const format of matches) {
      const list = byCategory.get(format.category) ?? [];
      list.push(format);
      byCategory.set(format.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      formats: byCategory.get(category) ?? [],
    }));
  }, [query]);

  return (
    <section aria-label="Choose a photo format" className="space-y-3">
      <label className="block">
        <span className="sr-only">Search formats</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search: 3x4, passport, US, 35×45…"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-ink-faint"
        />
      </label>

      {groups.length === 0 && (
        <p className="text-sm text-ink-muted">
          No format matches “{query}”. Try a size like 35x45, or a country.
        </p>
      )}

      <div className="space-y-4">
        {groups.map(({ category, formats }) => (
          <div key={category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {CATEGORY_LABEL[category]}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {formats.map((format) => {
                const selected = format.id === formatId;
                return (
                  <button
                    key={format.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFormat(format.id)}
                    className={`flex min-h-[44px] flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:bg-canvas"
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {formatLabel(format)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatDimensions(format)}
                      {format.head_min_mm !== null && format.head_max_mm !== null
                        ? ` · head ${format.head_min_mm}–${format.head_max_mm} mm`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
