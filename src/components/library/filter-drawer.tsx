"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Genre {
  id: string;
  name: string;
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  genres: Genre[];
  selectedGenres: string[];
  onToggleGenre: (name: string) => void;
  unwatchedOnly: boolean;
  onToggleUnwatched: () => void;
  onClear: () => void;
}

/** Slide-over advanced filter panel (genres, unwatched). */
export function FilterDrawer({
  open,
  onClose,
  genres,
  selectedGenres,
  onToggleGenre,
  unwatchedOnly,
  onToggleUnwatched,
  onClear,
}: FilterDrawerProps) {
  const t = useTranslations("Library");
  const tc = useTranslations("Common");

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[340px] max-w-[88vw] flex-col border-l border-border bg-surface transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{tc("filter")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("filter")}
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <label className="mb-6 flex cursor-pointer items-center justify-between">
            <span className="text-sm font-semibold">{t("unwatched")}</span>
            <input
              type="checkbox"
              checked={unwatchedOnly}
              onChange={onToggleUnwatched}
              className="size-4 accent-accent"
            />
          </label>

          <h3 className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">
            {t("genre")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const active = selectedGenres.includes(g.name);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onToggleGenre(g.name)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    active
                      ? "bg-accent text-on-accent"
                      : "bg-white/[0.05] text-bright hover:bg-white/[0.1]",
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-lg border border-border-strong py-2.5 text-sm font-bold text-bright transition-colors hover:bg-white/[0.06]"
          >
            {t("clear")}
          </button>
        </div>
      </aside>
    </>
  );
}
