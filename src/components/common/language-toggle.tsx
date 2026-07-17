"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** EN/TR segmented toggle. Persists to a cookie and refreshes server state. */
export function LanguageToggle({ className }: { className?: string }) {
  const active = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function select(locale: Locale) {
    if (locale === active) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex rounded-lg bg-white/[0.06] p-[3px]",
        isPending && "opacity-60",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            aria-pressed={isActive}
            className={cn(
              "cursor-pointer rounded-[6px] px-[10px] py-1 text-xs font-bold uppercase transition-colors",
              isActive
                ? "bg-white/12 text-text"
                : "text-muted hover:text-bright",
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
