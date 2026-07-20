"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
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
  years: string[];
  selectedYears: string[];
  onToggleYear: (year: string) => void;
  ratings: string[];
  selectedRatings: string[];
  onToggleRating: (rating: string) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  studios: string[];
  selectedStudios: string[];
  onToggleStudio: (studio: string) => void;
  unwatchedOnly: boolean;
  onToggleUnwatched: () => void;
  onClear: () => void;
}

/** A chip group with an optional search box for long facet lists. */
function ChipGroup({
  title,
  options,
  selected,
  onToggle,
  searchable,
  placeholder,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  if (options.length === 0) return null;
  const query = q.trim().toLowerCase();
  const shown = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">
        {title}
      </h3>
      {searchable && options.length > 12 && (
        <div className="relative mb-2.5">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-8 w-full rounded-lg border border-border-strong bg-white/[0.04] pr-2.5 pl-8 text-[12.5px] text-text outline-none focus:border-accent"
          />
        </div>
      )}
      <div className="flex max-h-[200px] flex-wrap gap-2 overflow-y-auto">
        {shown.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-accent text-on-accent"
                  : "bg-white/[0.05] text-bright hover:bg-white/[0.1]",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Slide-over advanced filter panel (genres, years, ratings, tags, studios). */
export function FilterDrawer({
  open,
  onClose,
  genres,
  selectedGenres,
  onToggleGenre,
  years,
  selectedYears,
  onToggleYear,
  ratings,
  selectedRatings,
  onToggleRating,
  tags,
  selectedTags,
  onToggleTag,
  studios,
  selectedStudios,
  onToggleStudio,
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

          <ChipGroup
            title={t("parentalRating")}
            options={ratings}
            selected={selectedRatings}
            onToggle={onToggleRating}
          />
          <ChipGroup
            title={t("year")}
            options={years}
            selected={selectedYears}
            onToggle={onToggleYear}
          />
          <ChipGroup
            title={t("genre")}
            options={genres.map((g) => g.name)}
            selected={selectedGenres}
            onToggle={onToggleGenre}
          />
          <ChipGroup
            title={t("studio")}
            options={studios}
            selected={selectedStudios}
            onToggle={onToggleStudio}
            searchable
            placeholder={t("searchStudios")}
          />
          <ChipGroup
            title={t("tag")}
            options={tags}
            selected={selectedTags}
            onToggle={onToggleTag}
            searchable
            placeholder={t("searchTags")}
          />
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
