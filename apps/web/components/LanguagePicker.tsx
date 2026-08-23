"use client";

import { LOCALES, LOCALE_META } from "../lib/locales";
import { useLocaleStore, useT } from "../lib/i18n";

/** Compact language switcher (EN · DE · دری · پښتو) for the editor header. */
export function LanguagePicker() {
  const { t } = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <label className="flex items-center">
      <span className="sr-only">{t.languageAria}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number])}
        className="h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink-muted hover:text-ink"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
