"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock, Search as SearchIcon, TrendingUp, X } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import {
  useItemsRow,
  useSearch,
  useSearchPeople,
} from "@/lib/jellyfin/queries";
import { useSearchHistory } from "@/lib/search/history";
import { gradientFallback, posterUrl } from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "all", types: "Movie,Series,Episode,BoxSet" },
  { key: "movies", types: "Movie" },
  { key: "series", types: "Series" },
  { key: "episodes", types: "Episode" },
  { key: "collections", types: "BoxSet" },
  { key: "people", types: "" },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

/** Debounce a fast-changing value. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchView({ initialQuery = "" }: { initialQuery?: string }) {
  const t = useTranslations("Search");
  const [raw, setRaw] = useState(initialQuery);
  const term = useDebounced(raw.trim());
  const [type, setType] = useState<TypeKey>("all");
  const { history, push, remove, clear } = useSearchHistory();

  const activeType = useMemo(() => TYPES.find((x) => x.key === type)!, [type]);

  const wantsItems = type !== "people";
  const wantsPeople = type === "people" || type === "all";

  const items = useSearch(term, activeType.types);
  const people = useSearchPeople(term);

  // Record a term once it's stable and produced results.
  useEffect(() => {
    if (term.length >= 2 && (items.data?.Items?.length ?? 0) > 0) push(term);
  }, [term, items.data, push]);

  // Trending fallback shown on the empty/no-result state — real popularity
  // (server-wide play count), not just top rated.
  const trending = useItemsRow("searchTrending", {
    includeItemTypes: "Movie,Series",
    sortBy: "PlayCount,SortName",
    sortOrder: "Descending",
    limit: 12,
  });

  const itemResults = wantsItems ? (items.data?.Items ?? []) : [];
  const peopleResults = wantsPeople ? (people.data?.Items ?? []) : [];
  const loading =
    (wantsItems && items.isLoading) || (wantsPeople && people.isLoading);

  const hasTerm = term.length > 0;
  const nothing =
    hasTerm && !loading && !itemResults.length && !peopleResults.length;

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-16">
      {/* Search box */}
      <div className="relative mb-6 max-w-[640px]">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-dim" />
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t("placeholder")}
          autoFocus
          autoComplete="off"
          className="h-13 w-full rounded-[12px] border border-border-strong bg-white/[0.05] py-3.5 pr-11 pl-12 text-[16px] text-text outline-none focus:border-accent"
        />
        {raw && (
          <button
            type="button"
            onClick={() => setRaw("")}
            aria-label={t("clear")}
            className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-dim transition-colors hover:bg-white/[0.08] hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Type chips */}
      <div className="mb-8 flex flex-wrap gap-2.5">
        {TYPES.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setType(x.key)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              type === x.key
                ? "bg-accent text-on-accent"
                : "bg-white/[0.05] text-bright hover:bg-white/[0.1]",
            )}
          >
            {t(x.key)}
          </button>
        ))}
      </div>

      {!hasTerm ? (
        <div>
          {history.length > 0 && (
            <section className="mb-10">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[15px] font-bold">
                  <Clock className="size-4 text-muted" /> {t("recent")}
                </h3>
                <button
                  type="button"
                  onClick={clear}
                  className="text-[12.5px] font-semibold text-muted hover:text-bright"
                >
                  {t("clearHistory")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <span
                    key={h}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1.5 pr-2 pl-3.5 text-[13px] font-semibold text-bright"
                  >
                    <button
                      type="button"
                      onClick={() => setRaw(h)}
                      className="transition-colors hover:text-accent"
                    >
                      {h}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(h)}
                      aria-label={t("clear")}
                      className="flex size-4 items-center justify-center rounded-full text-dim hover:text-text"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-4 flex items-center gap-2 text-[15px] font-bold">
              <TrendingUp className="size-4 text-muted" /> {t("trending")}
            </h3>
            {trending.isLoading ? (
              <GridSkeleton />
            ) : (
              <div className="jn-stagger grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
                {(trending.data?.Items ?? []).map((item) => (
                  <MediaCard key={item.Id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {/* People */}
          {wantsPeople && peopleResults.length > 0 && (
            <section className="mb-10">
              <h3 className="mb-4 text-[15px] font-bold">{t("people")}</h3>
              <div className="flex flex-wrap gap-6">
                {peopleResults.map((p) => (
                  <PersonAvatar key={p.Id} person={p} />
                ))}
              </div>
            </section>
          )}

          {/* Items */}
          {wantsItems &&
            (loading && !itemResults.length ? (
              <GridSkeleton />
            ) : itemResults.length > 0 ? (
              <section>
                {type === "all" && (
                  <h3 className="mb-4 text-[15px] font-bold">{t("results")}</h3>
                )}
                <div className="jn-stagger grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
                  {itemResults.map((item) => (
                    <MediaCard key={item.Id} item={item} />
                  ))}
                </div>
              </section>
            ) : null)}

          {nothing && (
            <div>
              <p className="pt-10 pb-8 text-center text-muted">
                {t("emptyFor", { term })}
              </p>
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-bold">
                <TrendingUp className="size-4 text-muted" /> {t("trending")}
              </h3>
              <div className="jn-stagger grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
                {(trending.data?.Items ?? []).map((item) => (
                  <MediaCard key={item.Id} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PersonAvatar({ person }: { person: BaseItemDto }) {
  const img = posterUrl(person, { maxWidth: 200 });
  return (
    <Link
      href={`/person/${person.Id}`}
      className="group flex w-24 flex-none flex-col items-center gap-2.5 text-center transition-transform hover:-translate-y-1"
    >
      <span
        className="size-24 rounded-full bg-cover bg-center ring-2 ring-transparent transition-[box-shadow] group-hover:ring-accent"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(person.Id)}`
            : gradientFallback(person.Id),
        }}
      />
      <span className="w-full truncate text-[12.5px] font-semibold text-bright">
        {person.Name}
      </span>
    </Link>
  );
}
