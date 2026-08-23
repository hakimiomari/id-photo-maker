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
import { useT } from "../lib/i18n";
import { usePhotoStore } from "../lib/store";
import { IconCheck, IconSearch } from "./icons";

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
  const { t, locale } = useT();

  const groups = useMemo(() => {
    const matches = query ? searchFormats(query, locale) : [...FORMATS];
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
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Search formats</span>
        <IconSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.picker.search}
          className="w-full rounded-control border border-line bg-canvas/60 py-2.5 ps-9 pe-3 text-sm transition-colors duration-150 placeholder:text-ink-faint focus:border-accent focus:bg-surface focus:outline-none"
        />
      </label>

      {groups.length === 0 && (
        <p className="text-sm text-ink-muted">{t.picker.noMatch(query)}
        </p>
      )}

      <div className="space-y-4">
        {groups.map(({ category, formats }) => (
          <div key={category}>
            <h3 className="eyebrow mb-2">{t.picker.categories[category]}</h3>
            <div className="grid grid-cols-2 gap-2">
              {formats.map((format) => {
                const selected = format.id === formatId;
                return (
                  <button
                    key={format.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFormat(format.id)}
                    className={`relative flex min-h-[44px] flex-col items-start gap-0.5 rounded-control border p-3 pe-7 text-start transition-all duration-150 ease-swift ${
                      selected
                        ? "border-accent bg-accent-soft shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]"
                        : "border-line bg-surface hover:border-line-strong hover:shadow-card"
                    }`}
                  >
                    {selected && (
                      <span className="absolute end-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-surface">
                        <IconCheck className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <span className="text-[13px] font-medium leading-snug">
                      {formatLabel(format, locale)}
                    </span>
                    <span className="text-xs tabular-nums text-ink-faint">
                      {formatDimensions(format)}
                      {format.head_min_mm !== null && format.head_max_mm !== null
                        ? ` · ${t.picker.headRange(format.head_min_mm, format.head_max_mm)}`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
