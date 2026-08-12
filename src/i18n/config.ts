export const locales = ["en", "tr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie key that persists the runtime-selected UI language. */
export const LOCALE_COOKIE = "jn_locale";

export function isLocale(value: string | undefined): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
