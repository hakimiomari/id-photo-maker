/**
 * The app's locales. Landing pages use URL prefixes (/de, /fa, /ps); the
 * editor is a single-page app whose locale lives in localStorage and can be
 * seeded via ?lang= (used by the landing pages' CTAs).
 */

export type Locale = "en" | "de" | "fa" | "ps";

export const LOCALES: readonly Locale[] = ["en", "de", "fa", "ps"];

export const LOCALE_META: Record<
  Locale,
  { lang: string; dir: "ltr" | "rtl"; nativeName: string }
> = {
  en: { lang: "en", dir: "ltr", nativeName: "English" },
  de: { lang: "de", dir: "ltr", nativeName: "Deutsch" },
  fa: { lang: "fa-AF", dir: "rtl", nativeName: "دری" },
  ps: { lang: "ps", dir: "rtl", nativeName: "پښتو" },
};

export function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}
