"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import { FilterDrawer } from "./filter-drawer";
import {
  useDisplayPreferences,
  useGenres,
  useItemFilters,
  useLibraryItems,
  useStudios,
  useUpdateDisplayPreferences,
  useUserViews,
} from "@/lib/jellyfin/queries";
import {
  formatRuntime,
  gradientFallback,
  posterUrl,
} from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "recent", sortBy: "DateCreated,SortName", sortOrder: "Descending" },
  { key: "name", sortBy: "SortName", sortOrder: "Ascending" },
  {
    key: "rating",
    sortBy: "CommunityRating,SortName",
    sortOrder: "Descending",
  },
  {
    key: "critic",
    sortBy: "CriticRating,SortName",
    sortOrder: "Descending",
  },
  { key: "year", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
  {
    key: "premiere",
    sortBy: "PremiereDate,SortName",
    sortOrder: "Descending",
  },
  { key: "runtime", sortBy: "Runtime,SortName", sortOrder: "Descending" },
  {
    key: "played",
    sortBy: "DatePlayed,SortName",
    sortOrder: "Descending",
  },
  { key: "random", sortBy: "Random", sortOrder: "Ascending" },
] as const;

const SORT_LABEL: Record<string, string> = {
  recent: "sortRecent",
  name: "sortName",
  rating: "sortRating",
  critic: "sortCritic",
  year: "sortYear",
  premiere: "sortPremiere",
  runtime: "sortRuntime",
  played: "sortPlayed",
  random: "sortRandom",
};

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Quick = "all" | "unwatched" | "watched" | "favorites";
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
  const searchParams = useSearchParams();

  const views = useUserViews();
  const parentId = useMemo(
    () =>
      views.data?.Items?.find((v) => v.CollectionType === collectionType)?.Id,
    [views.data, collectionType],
  );

  // A comma/pipe-separated URL param → initial multi-select filter.
  const fromParam = (key: string) => {
    const raw = searchParams.get(key);
    return raw ? raw.split(/[,|]/).filter(Boolean) : [];
  };

  const [sortKey, setSortKey] =
    useState<(typeof SORTS)[number]["key"]>("recent");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">(
    "Descending",
  );
  const [quick, setQuick] = useState<Quick>("all");
  const [genres, setGenres] = useState<string[]>(() => fromParam("genre"));
  const [years, setYears] = useState<string[]>(() => fromParam("year"));
  const [ratings, setRatings] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(() => fromParam("tag"));
  const [studios, setStudios] = useState<string[]>(() => fromParam("studio"));
  const [letter, setLetter] = useState<string>("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Sort + view mode sync to server-side DisplayPreferences so the choice
  // follows the user across devices (and matches the official client).
  const sortPrefKey = `jn-sort-${collectionType}`;
  const dirPrefKey = `jn-sortdir-${collectionType}`;
  const viewPrefKey = `jn-view-${collectionType}`;
  const displayPrefs = useDisplayPreferences();
  const updateDisplayPrefs = useUpdateDisplayPreferences();
  const [seededPrefs, setSeededPrefs] = useState(false);
  if (displayPrefs.data && !seededPrefs) {
    setSeededPrefs(true);
    const cp = displayPrefs.data.CustomPrefs ?? {};
    const savedSort = cp[sortPrefKey];
    const savedDir = cp[dirPrefKey];
    const savedView = cp[viewPrefKey];
    const matchedSort = SORTS.find((s) => s.key === savedSort);
    if (matchedSort) {
      setSortKey(matchedSort.key);
      // Fall back to the field's natural direction when none was saved.
      setSortDir(
        savedDir === "Ascending" || savedDir === "Descending"
          ? savedDir
          : matchedSort.sortOrder,
      );
    } else if (savedDir === "Ascending" || savedDir === "Descending") {
      setSortDir(savedDir);
    }
    if (savedView === "grid" || savedView === "list") setView(savedView);
  }
  const persistPref = (key: string, value: string) => {
    const base = displayPrefs.data;
    if (!base) return;
    updateDisplayPrefs.mutate({
      ...base,
      CustomPrefs: { ...(base.CustomPrefs ?? {}), [key]: value },
    });
  };

  const genreQuery = useGenres(parentId);
  const filterFacets = useItemFilters(parentId, includeItemTypes);
  const studioQuery = useStudios(parentId);
  const sort = SORTS.find((s) => s.key === sortKey)!;
  const directional = sortKey !== "random";

  // Pick a sort field (resetting to its natural direction); pick the same field
  // again — or hit the direction toggle — to reverse it.
  const chooseSort = (key: (typeof SORTS)[number]["key"]) => {
    const target = SORTS.find((s) => s.key === key)!;
    if (key === sortKey && key !== "random") {
      flipDir();
      return;
    }
    setSortKey(key);
    setSortDir(target.sortOrder);
    persistPref(sortPrefKey, key);
    persistPref(dirPrefKey, target.sortOrder);
    setLimit(PAGE);
  };
  const flipDir = () => {
    const next = sortDir === "Ascending" ? "Descending" : "Ascending";
    setSortDir(next);
    persistPref(dirPrefKey, next);
    setLimit(PAGE);
  };

  const filters: string[] = [];
  if (quick === "unwatched") filters.push("IsUnplayed");
  if (quick === "watched") filters.push("IsPlayed");
  if (quick === "favorites") filters.push("IsFavorite");

  const query = useLibraryItems(
    {
      parentId,
      includeItemTypes,
      sortBy: sort.sortBy,
      sortOrder: sortDir,
      filters: filters.length ? filters.join(",") : undefined,
      genres: genres.length ? genres.join("|") : undefined,
      years: years.length ? years.join(",") : undefined,
      officialRatings: ratings.length ? ratings.join("|") : undefined,
      tags: tags.length ? tags.join("|") : undefined,
      studios: studios.length ? studios.join("|") : undefined,
      nameStartsWith: letter === "#" ? undefined : letter || undefined,
      limit,
    },
    !views.isLoading,
  );

  const items = query.data?.Items ?? [];
  const total = query.data?.TotalRecordCount ?? 0;

  const resetPage = () => setLimit(PAGE);
  function toggleGenre(name: string) {
    setGenres((g) =>
      g.includes(name) ? g.filter((x) => x !== name) : [...g, name],
    );
    resetPage();
  }
  function toggleYear(year: string) {
    setYears((y) =>
      y.includes(year) ? y.filter((x) => x !== year) : [...y, year],
    );
    resetPage();
  }
  function toggleRating(rating: string) {
    setRatings((r) =>
      r.includes(rating) ? r.filter((x) => x !== rating) : [...r, rating],
    );
    resetPage();
  }
  function toggleTag(tag: string) {
    setTags((tg) =>
      tg.includes(tag) ? tg.filter((x) => x !== tag) : [...tg, tag],
    );
    resetPage();
  }
  function toggleStudio(studio: string) {
    setStudios((s) =>
      s.includes(studio) ? s.filter((x) => x !== studio) : [...s, studio],
    );
    resetPage();
  }
  function clearAllFilters() {
    setGenres([]);
    setYears([]);
    setRatings([]);
    setTags([]);
    setStudios([]);
    resetPage();
  }

  const quickFilters: Quick[] = ["all", "unwatched", "watched", "favorites"];
  const filterCount =
    genres.length +
    years.length +
    ratings.length +
    tags.length +
    studios.length;

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-16">
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

        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-white/[0.03] px-3.5 py-2 text-[13px] font-semibold text-bright hover:bg-white/[0.07]"
          >
            <ArrowDownUp className="size-4" /> {t(SORT_LABEL[sortKey])}
          </button>
          {directional && (
            <button
              type="button"
              onClick={flipDir}
              aria-label={
                sortDir === "Ascending" ? t("sortDesc") : t("sortAsc")
              }
              title={sortDir === "Ascending" ? t("sortDesc") : t("sortAsc")}
              className="flex items-center justify-center rounded-lg border border-border-strong bg-white/[0.03] px-2.5 py-2 text-bright transition-colors hover:bg-white/[0.07]"
            >
              {sortDir === "Ascending" ? (
                <ArrowUp className="size-4" />
              ) : (
                <ArrowDown className="size-4" />
              )}
            </button>
          )}
          {sortOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden
                onClick={() => setSortOpen(false)}
              />
              <div className="animate-jn-pop absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-border-strong bg-surface p-1.5 shadow-2xl">
                {SORTS.map((s) => {
                  const activeSort = sortKey === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        chooseSort(s.key);
                        setSortOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-white/[0.06]"
                    >
                      <Check
                        className={cn(
                          "size-4 text-accent",
                          activeSort ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex-1">{t(SORT_LABEL[s.key])}</span>
                      {activeSort && s.key !== "random" ? (
                        sortDir === "Ascending" ? (
                          <ArrowUp className="size-3.5 text-accent" />
                        ) : (
                          <ArrowDown className="size-3.5 text-accent" />
                        )
                      ) : null}
                    </button>
                  );
                })}
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

        <div className="flex overflow-hidden rounded-lg border border-border-strong">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                persistPref(viewPrefKey, v);
              }}
              aria-label={v === "grid" ? t("viewGrid") : t("viewList")}
              title={v === "grid" ? t("viewGrid") : t("viewList")}
              className={cn(
                "flex size-9 items-center justify-center transition-colors",
                view === v
                  ? "bg-accent text-on-accent"
                  : "bg-white/[0.03] text-muted hover:bg-white/[0.07] hover:text-bright",
              )}
            >
              {v === "grid" ? (
                <LayoutGrid className="size-4" />
              ) : (
                <List className="size-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter chips */}
      {filterCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {[
            ...genres.map((g) => ({ kind: "g" as const, v: g })),
            ...years.map((y) => ({ kind: "y" as const, v: y })),
            ...ratings.map((r) => ({ kind: "r" as const, v: r })),
            ...tags.map((tg) => ({ kind: "t" as const, v: tg })),
            ...studios.map((s) => ({ kind: "s" as const, v: s })),
          ].map((chip) => (
            <button
              key={`${chip.kind}-${chip.v}`}
              type="button"
              onClick={() =>
                chip.kind === "g"
                  ? toggleGenre(chip.v)
                  : chip.kind === "y"
                    ? toggleYear(chip.v)
                    : chip.kind === "r"
                      ? toggleRating(chip.v)
                      : chip.kind === "t"
                        ? toggleTag(chip.v)
                        : toggleStudio(chip.v)
              }
              className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[12.5px] font-semibold text-accent transition-colors hover:bg-accent/25"
            >
              {chip.v}
              <X className="size-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[12.5px] font-semibold text-muted hover:text-bright"
          >
            {t("clear")}
          </button>
        </div>
      )}

      {/* A–Z jump bar */}
      <div className="mb-6 flex flex-wrap gap-0.5">
        {LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setLetter((cur) => (cur === l ? "" : l));
              resetPage();
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-[12px] font-bold transition-colors",
              letter === l
                ? "bg-accent text-on-accent"
                : "text-muted hover:bg-white/[0.08] hover:text-bright",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {query.isLoading && !items.length ? (
        <GridSkeleton />
      ) : items.length ? (
        <>
          {view === "grid" ? (
            <div className="jn-stagger grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
              {items.map((item) => (
                <MediaCard key={item.Id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {items.map((item) => (
                <ListRow key={item.Id} item={item} />
              ))}
            </div>
          )}
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
        genres={(
          filterFacets.data?.Genres?.map((g) => ({ id: g, name: g })) ??
          (genreQuery.data?.Items ?? []).map((g) => ({
            id: g.Id ?? g.Name ?? "",
            name: g.Name ?? "",
          }))
        ).filter((g) => g.name)}
        selectedGenres={genres}
        onToggleGenre={toggleGenre}
        years={(filterFacets.data?.Years ?? [])
          .slice()
          .sort((a, b) => b - a)
          .map(String)}
        selectedYears={years}
        onToggleYear={toggleYear}
        ratings={filterFacets.data?.OfficialRatings ?? []}
        selectedRatings={ratings}
        onToggleRating={toggleRating}
        tags={filterFacets.data?.Tags ?? []}
        selectedTags={tags}
        onToggleTag={toggleTag}
        studios={(studioQuery.data?.Items ?? [])
          .map((s) => s.Name ?? "")
          .filter(Boolean)}
        selectedStudios={studios}
        onToggleStudio={toggleStudio}
        unwatchedOnly={quick === "unwatched"}
        onToggleUnwatched={() => {
          setQuick((q) => (q === "unwatched" ? "all" : "unwatched"));
          setLimit(PAGE);
        }}
        onClear={() => {
          clearAllFilters();
          setQuick("all");
        }}
      />
    </div>
  );
}

/** Compact horizontal row for the list view. */
function ListRow({ item }: { item: BaseItemDto }) {
  const img = posterUrl(item, { maxWidth: 120 });
  const meta = [
    item.ProductionYear?.toString(),
    item.OfficialRating ?? undefined,
    formatRuntime(item.RunTimeTicks) || undefined,
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : undefined,
  ].filter(Boolean);
  return (
    <Link
      href={`/item/${item.Id}`}
      className="group flex items-center gap-4 py-3 transition-colors hover:bg-white/[0.03]"
    >
      <div
        className="aspect-[2/3] w-[52px] flex-none rounded-md bg-cover bg-center"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(item.Id)}`
            : gradientFallback(item.Id),
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold group-hover:text-accent">
          {item.Name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        {item.Genres?.length ? (
          <div className="mt-0.5 truncate text-[12px] text-dim">
            {item.Genres.slice(0, 3).join(" · ")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
