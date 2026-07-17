"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownUp, Check, SlidersHorizontal } from "lucide-react";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import { FilterDrawer } from "./filter-drawer";
import {
  useGenres,
  useLibraryItems,
  useUserViews,
} from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "recent", sortBy: "DateCreated,SortName", sortOrder: "Descending" },
  { key: "name", sortBy: "SortName", sortOrder: "Ascending" },
  {
    key: "rating",
    sortBy: "CommunityRating,SortName",
    sortOrder: "Descending",
  },
  { key: "year", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
  { key: "random", sortBy: "Random", sortOrder: "Ascending" },
] as const;

const SORT_LABEL: Record<string, string> = {
  recent: "sortRecent",
  name: "sortName",
  rating: "sortRating",
  year: "sortYear",
  random: "sortRandom",
};

type Quick = "all" | "unwatched" | "favorites";
const PAGE = 48;

interface LibraryViewProps {
  title: string;
  collectionType: string;
  includeItemTypes: string;
}

export function LibraryView({
  title,
  collectionType,
  includeItemTypes,
}: LibraryViewProps) {
  const t = useTranslations("Library");
  const tc = useTranslations("Common");

  const views = useUserViews();
  const parentId = useMemo(
    () =>
      views.data?.Items?.find((v) => v.CollectionType === collectionType)?.Id,
    [views.data, collectionType],
  );

  const [sortKey, setSortKey] =
    useState<(typeof SORTS)[number]["key"]>("recent");
  const [quick, setQuick] = useState<Quick>("all");
  const [genres, setGenres] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const genreQuery = useGenres(parentId);
  const sort = SORTS.find((s) => s.key === sortKey)!;

  const filters: string[] = [];
  if (quick === "unwatched") filters.push("IsUnplayed");
  if (quick === "favorites") filters.push("IsFavorite");

  const query = useLibraryItems(
    {
      parentId,
      includeItemTypes,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      filters: filters.length ? filters.join(",") : undefined,
      genres: genres.length ? genres.join("|") : undefined,
      limit,
    },
    !views.isLoading,
  );

  const items = query.data?.Items ?? [];
  const total = query.data?.TotalRecordCount ?? 0;

  function toggleGenre(name: string) {
    setGenres((g) =>
      g.includes(name) ? g.filter((x) => x !== name) : [...g, name],
    );
    setLimit(PAGE);
  }

  const quickFilters: Quick[] = ["all", "unwatched", "favorites"];
  const filterCount = genres.length;

  return (
    <div className="px-10 pt-8 pb-16">
      <div className="mb-6 flex items-end gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
        <span className="pb-1.5 text-[13.5px] text-muted">
          {total} {tc("items")}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        {quickFilters.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setQuick(q);
              setLimit(PAGE);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              quick === q
                ? "bg-accent text-on-accent"
                : "bg-white/[0.05] text-bright hover:bg-white/[0.1]",
            )}
          >
            {t(q)}
          </button>
        ))}

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-white/[0.03] px-3.5 py-2 text-[13px] font-semibold text-bright hover:bg-white/[0.07]"
          >
            <ArrowDownUp className="size-4" /> {t(SORT_LABEL[sortKey])}
          </button>
          {sortOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden
                onClick={() => setSortOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-border-strong bg-surface p-1.5 shadow-2xl">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSortKey(s.key);
                      setSortOpen(false);
                      setLimit(PAGE);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-white/[0.06]"
                  >
                    <Check
                      className={cn(
                        "size-4 text-accent",
                        sortKey === s.key ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {t(SORT_LABEL[s.key])}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-white/[0.03] px-3.5 py-2 text-[13px] font-semibold text-bright hover:bg-white/[0.07]"
        >
          <SlidersHorizontal className="size-4" /> {tc("filter")}
          {filterCount > 0 && (
            <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-on-accent">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {query.isLoading && !items.length ? (
        <GridSkeleton />
      ) : items.length ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
            {items.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
          {items.length < total && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                disabled={query.isFetching}
                className="rounded-lg border border-border-strong px-6 py-2.5 text-sm font-bold text-bright hover:bg-white/[0.06] disabled:opacity-60"
              >
                {t("loadMore")}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="py-20 text-center text-muted">{t("noItems")}</p>
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        genres={(genreQuery.data?.Items ?? []).map((g) => ({
          id: g.Id ?? g.Name ?? "",
          name: g.Name ?? "",
        }))}
        selectedGenres={genres}
        onToggleGenre={toggleGenre}
        unwatchedOnly={quick === "unwatched"}
        onToggleUnwatched={() => {
          setQuick((q) => (q === "unwatched" ? "all" : "unwatched"));
          setLimit(PAGE);
        }}
        onClear={() => {
          setGenres([]);
          setQuick("all");
          setLimit(PAGE);
        }}
      />
    </div>
  );
}
