"use client";

import { useLocale } from "next-intl";

/**
 * Returns a formatter that turns an ISO date into a localized relative time
 * ("3 minutes ago"). Shared by the admin dashboard and the notification center.
 */
export function useTimeAgo() {
  const locale = useLocale();
  return (input?: string | number | null): string => {
    if (input == null) return "—";
    const ts = typeof input === "number" ? input : Date.parse(input);
    if (Number.isNaN(ts)) return "—";
    const diff = (ts - Date.now()) / 1000;
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, secs] of units) {
      if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
    }
    return rtf.format(Math.round(diff), "second");
  };
}
