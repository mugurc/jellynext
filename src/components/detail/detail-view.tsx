"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Heart,
  ListPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Radio,
  ScanSearch,
  Share2,
  Trash2,
} from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { itemImageUrl } from "@/lib/jellyfin/browser";
import {
  backdropUrl,
  formatClock,
  formatRuntime,
  gradientFallback,
  logoUrl,
  resumePercent,
  thumbUrl,
  ticksToSeconds,
} from "@/lib/jellyfin/media";
import {
  useDeleteItem,
  useItem,
  useSeriesNextUp,
  useSimilarItems,
  useSpecialFeatures,
  useToggleFavorite,
  useTogglePlayed,
} from "@/lib/jellyfin/queries";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import { useCurrentUser } from "@/lib/auth/current-user";
import { jf } from "@/lib/jellyfin/browser";
import { useAdjacentEpisodes } from "@/lib/jellyfin/player-queries";
import { usePlayQueue } from "@/lib/player/queue";
import type { BaseItemDtoQueryResult } from "@jellyfin/sdk/lib/generated-client";
import { EpisodesTab } from "./episodes-tab";
import { DetailsTab } from "./details-tab";
import { TrackPreselect } from "./track-preselect";
import { TrailerModal } from "./trailer-modal";
import { ItemEditModal } from "./item-edit-modal";
import { AddToListModal } from "./add-to-list-modal";
import { IdentifyModal } from "./identify-modal";
import { AlbumView } from "@/components/music/album-view";
import { ArtistView } from "@/components/music/artist-view";
import { CollectionView } from "./collection-view";
import { Portal } from "@/components/common/portal";
import { cn } from "@/lib/utils";

type TabKey = "episodes" | "related" | "details" | "cast";

export function DetailView({ itemId }: { itemId: string }) {
  const t = useTranslations("Detail");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { data: item, isLoading } = useItem(itemId);

  const { userId, isAdmin } = useCurrentUser();
  const setQueue = usePlayQueue((s) => s.setQueue);
  const clearQueue = usePlayQueue((s) => s.clear);
  const favorite = useToggleFavorite();
  const played = useTogglePlayed();
  const deleteItem = useDeleteItem();
  const nextUp = useSeriesNextUp(
    item?.Type === "Series" ? item?.Id : undefined,
  );
  const nextEp = nextUp.data?.Items?.[0];
  const isSeries = item?.Type === "Series";
  const isEpisode = item?.Type === "Episode";
  const episodeSiblings = useAdjacentEpisodes(
    item?.Type === "Episode" ? (item?.SeriesId ?? undefined) : undefined,
    item?.Type === "Episode" ? itemId : undefined,
  );
  const [tab, setTab] = useState<TabKey>("details");
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addListOpen, setAddListOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; seq: number } | null>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = (text: string) =>
    setToast((prev) => ({ text, seq: (prev?.seq ?? 0) + 1 }));

  if (isLoading || !item) {
    return (
      <div>
        <div className="h-[540px] animate-pulse bg-card/40" />
        <div className="px-10 py-8">
          <GridSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (item.Type === "MusicAlbum") return <AlbumView item={item} />;
  if (item.Type === "MusicArtist") return <ArtistView item={item} />;
  if (item.Type === "BoxSet" || item.Type === "Playlist")
    return <CollectionView item={item} />;

  const backdrop = backdropUrl(item, { maxWidth: 1600 });
  // Episodes keep a text title (the episode name); movies/series show their
  // own title logo when they have one.
  const logo = isEpisode ? null : logoUrl(item, { maxHeight: 220 });
  const resume = resumePercent(item);
  const trailerUrl = item.RemoteTrailers?.[0]?.Url;
  // Which library a genre/studio chip should filter within.
  const libraryBase =
    item.Type === "Series" || item.Type === "Episode" ? "/tv" : "/movies";
  const filterHref = (key: string, value: string) =>
    `${libraryBase}?${key}=${encodeURIComponent(value)}`;
  const tabs: TabKey[] = isSeries
    ? ["episodes", "related", "details", "cast"]
    : isEpisode
      ? ["details", "cast"]
      : ["related", "details", "cast"];
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const tabLabel: Record<TabKey, string> = {
    episodes: t("tabEpisodes"),
    related: t("tabRelated"),
    details: t("tabDetails"),
    cast: t("tabCast"),
  };

  const PLAYABLE = ["Movie", "Episode", "Video", "MusicVideo"];

  async function play() {
    if (!item?.Id) return;
    // Series → queue every episode, start at the next unwatched one. The
    // library can hold DUPLICATE files per episode as separate items, so
    // collapse by season+number to avoid playing each one twice.
    if (item.Type === "Series") {
      const eps = await jf
        .get<BaseItemDtoQueryResult>(`/Shows/${item.Id}/Episodes`, { userId })
        .catch(() => null);
      const seen = new Set<string>();
      const uniqueEps = (eps?.Items ?? []).filter((e) => {
        const key = `${e.ParentIndexNumber}-${e.IndexNumber}`;
        if (!e.Id || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const ids = uniqueEps
        .map((e) => e.Id)
        .filter((id): id is string => Boolean(id));
      if (ids.length) setQueue(ids, item.Name ?? "");
      // Start on the queue entry matching the next-up episode (its own id may
      // be a different duplicate that isn't in the deduped queue).
      const startEp = nextEp
        ? uniqueEps.find(
            (e) =>
              e.ParentIndexNumber === nextEp.ParentIndexNumber &&
              e.IndexNumber === nextEp.IndexNumber,
          )
        : undefined;
      const startId = startEp?.Id ?? ids[0];
      if (startId) router.push(`/watch/${startId}`);
      else setTab("episodes");
      return;
    }
    // Collection / playlist → queue its playable children, start at the first
    // (deduped by title+year, same duplicate-file caveat as above).
    if (item.Type === "BoxSet" || item.Type === "Playlist") {
      const res = await jf
        .get<BaseItemDtoQueryResult>(
          item.Type === "Playlist" ? `/Playlists/${item.Id}/Items` : "/Items",
          item.Type === "Playlist"
            ? { userId }
            : { parentId: item.Id, userId, sortBy: "SortName" },
        )
        .catch(() => null);
      const seen = new Set<string>();
      const ids = (res?.Items ?? [])
        .filter((c) => c.Type && PLAYABLE.includes(c.Type))
        .filter((c) => {
          const key = `${c.Name}-${c.ProductionYear ?? ""}`;
          if (!c.Id || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => c.Id)
        .filter((id): id is string => Boolean(id));
      if (ids.length) {
        setQueue(ids, item.Name ?? "");
        router.push(`/watch/${ids[0]}`);
      }
      return;
    }
    // Standalone title → no queue.
    clearQueue();
    router.push(`/watch/${item.Id}`);
  }

  // Instant mix: queue a radio-style run of related titles, starting here.
  async function playMix() {
    if (!item?.Id) return;
    const mix = await jf
      .get<BaseItemDtoQueryResult>(`/Items/${item.Id}/InstantMix`, {
        userId,
        limit: 50,
      })
      .catch(() => null);
    const ids = (mix?.Items ?? [])
      .map((m) => m.Id)
      .filter((id): id is string => Boolean(id));
    if (ids.length) {
      setQueue(ids, item.Name ?? "");
      router.push(`/watch/${ids[0]}`);
    }
  }

  return (
    <div className="animate-jn-fade">
      {/* Hero */}
      <section className="relative flex min-h-[540px] items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url("${backdrop}"), ${gradientFallback(item.Id)}`
              : gradientFallback(item.Id),
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />

        <DetailMenu
          item={item}
          isAdmin={isAdmin}
          onAddToList={() => setAddListOpen(true)}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onIdentify={() => setIdentifyOpen(true)}
          onPlayMix={playMix}
          onToast={showToast}
        />

        <div className="relative flex w-full flex-col gap-6 px-10 pb-11 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-[680px]">
            <div className="mb-3.5 text-[12.5px] font-semibold text-muted">
              {isEpisode ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.SeriesId ? (
                    <Link
                      href={`/item/${item.SeriesId}`}
                      className="font-bold text-bright transition-colors hover:text-accent"
                    >
                      {item.SeriesName}
                    </Link>
                  ) : (
                    <span className="font-bold text-bright">
                      {item.SeriesName}
                    </span>
                  )}
                  {item.ParentIndexNumber != null &&
                    item.IndexNumber != null && (
                      <span>
                        · S{item.ParentIndexNumber} · E{item.IndexNumber}
                      </span>
                    )}
                </span>
              ) : isSeries ? (
                "Series"
              ) : (
                "Movie"
              )}
            </div>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={item.Name ?? ""}
                className="animate-jn-fade mb-4 max-h-[120px] w-auto max-w-[460px] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
              />
            ) : (
              <h1 className="mb-4 text-[52px] leading-none font-extrabold tracking-[-0.03em] text-balance">
                {item.Name}
              </h1>
            )}
            {item.Taglines?.[0] && (
              <p className="mb-3.5 text-[15.5px] font-medium text-para italic">
                {item.Taglines[0]}
              </p>
            )}
            <div className="mb-3.5 flex flex-wrap items-center gap-3.5 text-[13.5px] font-semibold text-bright">
              <RatingBadges item={item} />
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.RunTimeTicks && (
                <span>{formatRuntime(item.RunTimeTicks)}</span>
              )}
              {item.OfficialRating && (
                <span className="rounded border border-bright/40 px-1.5 text-[11.5px]">
                  {item.OfficialRating}
                </span>
              )}
              {item.Studios?.[0]?.Name && (
                <Link
                  href={filterHref("studio", item.Studios[0].Name)}
                  className="transition-colors hover:text-accent"
                >
                  {item.Studios[0].Name}
                </Link>
              )}
              {isSeries && item.Status && (
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      item.Status === "Continuing"
                        ? "bg-emerald-400"
                        : "bg-muted",
                    )}
                  />
                  {item.Status === "Continuing" ? t("continuing") : t("ended")}
                  {item.Status === "Ended" && item.EndDate
                    ? ` ${new Date(item.EndDate).getFullYear()}`
                    : ""}
                </span>
              )}
            </div>
            {item.Genres?.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {item.Genres.map((g) => (
                  <Link
                    key={g}
                    href={filterHref("genre", g)}
                    className="rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-semibold text-bright transition-colors hover:bg-accent hover:text-on-accent"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            ) : null}
            {item.Overview && (
              <p className="mb-6 max-w-[600px] text-[15.5px] leading-relaxed text-pretty text-para">
                {item.Overview}
              </p>
            )}
            {isEpisode &&
              (episodeSiblings.data?.previous ||
                episodeSiblings.data?.next) && (
                <div className="mb-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      episodeSiblings.data?.previous?.Id &&
                      router.push(`/item/${episodeSiblings.data.previous.Id}`)
                    }
                    disabled={!episodeSiblings.data?.previous}
                    className="flex items-center gap-1.5 rounded-lg border border-bright/40 bg-white/[0.08] px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:border-white disabled:opacity-35 disabled:hover:border-bright/40"
                  >
                    <ChevronLeft className="size-4" />
                    {t("prevEpisode")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      episodeSiblings.data?.next?.Id &&
                      router.push(`/item/${episodeSiblings.data.next.Id}`)
                    }
                    disabled={!episodeSiblings.data?.next}
                    className="flex items-center gap-1.5 rounded-lg border border-bright/40 bg-white/[0.08] px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:border-white disabled:opacity-35 disabled:hover:border-bright/40"
                  >
                    {t("nextEpisode")}
                    <ChevronRight className="size-4" />
                  </button>
                  {item.SeriesId && (
                    <Link
                      href={`/item/${item.SeriesId}`}
                      className="ml-1 text-[12.5px] font-semibold text-muted transition-colors hover:text-bright"
                    >
                      {t("allEpisodes")}
                    </Link>
                  )}
                </div>
              )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={play}
                className="flex items-center gap-2.5 rounded-lg bg-white px-8 py-3.5 text-base font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
              >
                <Play className="size-5 fill-current" />
                {resume > 1 ? t("resume") : tc("play")}
              </button>
              {trailerUrl && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  aria-label={t("trailer")}
                  title={t("trailer")}
                  className="flex size-[50px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
                >
                  <Film className="size-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  item.Id &&
                  favorite.mutate({
                    id: item.Id,
                    favorite: !item.UserData?.IsFavorite,
                  })
                }
                disabled={favorite.isPending}
                aria-label={t("watchlist")}
                title={t("watchlist")}
                className={cn(
                  "flex size-[50px] items-center justify-center rounded-lg border-[1.5px] transition disabled:opacity-60",
                  item.UserData?.IsFavorite
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-bright/40 bg-white/[0.12] text-white hover:border-white",
                )}
              >
                <Heart
                  className={cn(
                    "size-5",
                    item.UserData?.IsFavorite && "fill-current",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() =>
                  item.Id &&
                  played.mutate({ id: item.Id, played: !item.UserData?.Played })
                }
                disabled={played.isPending}
                aria-label={
                  item.UserData?.Played ? t("watched") : t("markWatched")
                }
                title={item.UserData?.Played ? t("watched") : t("markWatched")}
                className={cn(
                  "flex size-[50px] items-center justify-center rounded-lg border-[1.5px] transition disabled:opacity-60",
                  item.UserData?.Played
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-bright/40 bg-white/[0.12] text-white hover:border-white",
                )}
              >
                <Check className="size-5" />
              </button>
            </div>

            {isSeries && nextEp && (
              <button
                type="button"
                onClick={() => nextEp.Id && router.push(`/watch/${nextEp.Id}`)}
                className="mt-3.5 flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-bright"
              >
                {t("nextUp")}:
                <span className="font-semibold text-bright">
                  S{nextEp.ParentIndexNumber}·E{nextEp.IndexNumber} —{" "}
                  {nextEp.Name}
                </span>
              </button>
            )}
          </div>

          {(isEpisode || item.Type === "Movie") && (
            <TrackPreselect item={item} />
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="px-10 pb-16">
        <div className="mb-7 flex gap-1.5 border-b border-border">
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-[14px] font-bold transition-colors",
                activeTab === k
                  ? "border-accent text-text"
                  : "border-transparent text-muted hover:text-bright",
              )}
            >
              {tabLabel[k]}
            </button>
          ))}
        </div>

        {activeTab === "episodes" && item.Id && (
          <EpisodesTab seriesId={item.Id} />
        )}
        {activeTab === "related" && <RelatedTab itemId={itemId} />}
        {activeTab === "details" && <DetailsTab item={item} />}
        {activeTab === "cast" && <CastScenesTab item={item} />}
      </div>

      {trailerOpen && trailerUrl && (
        <TrailerModal
          url={trailerUrl}
          title={item.Name}
          onClose={() => setTrailerOpen(false)}
        />
      )}

      {editOpen && (
        <ItemEditModal item={item} onClose={() => setEditOpen(false)} />
      )}

      {addListOpen && (
        <AddToListModal item={item} onClose={() => setAddListOpen(false)} />
      )}

      {deleteOpen && (
        <DeleteConfirm
          item={item}
          pending={deleteItem.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() =>
            item.Id &&
            deleteItem.mutate(item.Id, {
              onSuccess: () => {
                setDeleteOpen(false);
                router.back();
              },
            })
          }
        />
      )}

      {identifyOpen && (
        <IdentifyModal item={item} onClose={() => setIdentifyOpen(false)} />
      )}

      {toast && (
        <div
          key={toast.seq}
          className="animate-jn-fade fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-border-strong bg-bg/95 px-5 py-2.5 text-[13.5px] font-semibold text-text shadow-2xl backdrop-blur-md"
          role="status"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function RelatedTab({ itemId }: { itemId: string }) {
  const t = useTranslations("Detail");
  const { data, isLoading } = useSimilarItems(itemId, 18);
  if (isLoading) return <GridSkeleton count={6} />;
  const items = data?.Items ?? [];
  if (!items.length)
    return <p className="py-10 text-center text-muted">{t("noRelated")}</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-[18px]">
      {items.map((i) => (
        <MediaCard key={i.Id} item={i} className="w-full" />
      ))}
    </div>
  );
}

function CastScenesTab({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Detail");
  const cast = (item.People ?? []).filter(
    (p) => p.Type === "Actor" || p.Type === "GuestStar",
  );
  const chapters = item.Chapters ?? [];
  const extras = useSpecialFeatures(
    item.Id,
    (item.SpecialFeatureCount ?? 0) > 0,
  );
  const features = extras.data ?? [];

  return (
    <div>
      {features.length > 0 && (
        <>
          <h3 className="mb-4 text-[17px] font-bold">{t("extras")}</h3>
          <div className="no-scrollbar mb-10 flex gap-3.5 overflow-x-auto pb-2">
            {features.map((f) => {
              const img = thumbUrl(f, { maxWidth: 320 });
              return (
                <Link
                  key={f.Id}
                  href={`/watch/${f.Id}`}
                  className="group w-[240px] flex-none"
                >
                  <div
                    className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-card bg-cover bg-center"
                    style={{
                      backgroundImage: img
                        ? `url("${img}"), ${gradientFallback(f.Id)}`
                        : gradientFallback(f.Id),
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-scrim/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-on-accent">
                        <Play className="size-4 fill-current" />
                      </span>
                    </div>
                    {f.RunTimeTicks && (
                      <span className="absolute right-1.5 bottom-1.5 rounded bg-scrim/75 px-1.5 py-0.5 text-[10.5px] font-bold">
                        {formatRuntime(f.RunTimeTicks)}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[13px] font-semibold text-bright">
                    {f.Name}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <h3 className="mb-4 text-[17px] font-bold">{t("cast")}</h3>
      <div className="mb-10 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        {cast.map((p, idx) => {
          const img = p.Id
            ? itemImageUrl(p.Id, "Primary", {
                tag: p.PrimaryImageTag,
                maxWidth: 120,
              })
            : null;
          return (
            <Link
              key={`${p.Id}-${idx}`}
              href={`/person/${p.Id}`}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]"
            >
              <span
                className="size-12 flex-none rounded-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    p.PrimaryImageTag && img
                      ? `url("${img}")`
                      : gradientFallback(p.Id),
                }}
              />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold">{p.Name}</div>
                <div className="truncate text-[11.5px] text-muted">
                  {p.Role}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {chapters.length > 0 && (
        <>
          <h3 className="text-[17px] font-bold">{t("scenes")}</h3>
          <p className="mb-4 text-[12.5px] text-muted">{t("scenesDesc")}</p>
          <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-2">
            {chapters.map((ch, i) => {
              const img = item.Id
                ? itemImageUrl(item.Id, "Chapter", {
                    tag: ch.ImageTag,
                    index: i,
                    maxWidth: 320,
                  })
                : null;
              return (
                <div key={i} className="w-[210px] flex-none">
                  <div
                    className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-card bg-cover bg-center"
                    style={{
                      backgroundImage:
                        ch.ImageTag && img
                          ? `url("${img}")`
                          : gradientFallback(`${item.Id}-${i}`),
                    }}
                  >
                    <span className="absolute bottom-2 left-2 rounded bg-scrim/80 px-1.5 py-0.5 text-[11px] font-bold text-accent">
                      {formatClock(ticksToSeconds(ch.StartPositionTicks))}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-bright">
                    {ch.Name}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** External rating badges: IMDb (linked) + Rotten Tomatoes critic score. */
function RatingBadges({ item }: { item: BaseItemDto }) {
  const imdbId = item.ProviderIds?.Imdb;
  const community = item.CommunityRating;
  const critic = item.CriticRating;

  if (community == null && critic == null) return null;

  return (
    <>
      {community != null &&
        (imdbId ? (
          <a
            href={`https://www.imdb.com/title/${imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on IMDb"
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          >
            <ImdbLogo />
            <span>{community.toFixed(1)}</span>
          </a>
        ) : (
          <span className="flex items-center gap-1.5">
            <ImdbLogo />
            <span>{community.toFixed(1)}</span>
          </span>
        ))}
      {critic != null && (
        <span
          className="flex items-center gap-1.5"
          title={`Rotten Tomatoes · ${critic >= 60 ? "Fresh" : "Rotten"}`}
        >
          <TomatoIcon fresh={critic >= 60} />
          <span>{Math.round(critic)}%</span>
        </span>
      )}
    </>
  );
}

/** The IMDb wordmark: black "IMDb" on the brand-yellow rounded badge. */
function ImdbLogo() {
  return (
    <span className="rounded-[3px] bg-[#F5C518] px-[5px] py-px text-[11px] leading-none font-black tracking-tight text-black">
      IMDb
    </span>
  );
}

/** A tomato icon — red for a Fresh score, green for Rotten. */
function TomatoIcon({ fresh }: { fresh: boolean }) {
  const body = fresh ? "#FA320A" : "#4CAF50";
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      role="img"
      aria-hidden
      className="flex-none"
    >
      <path
        d="M12 6.2c3.8 0 6.9 2.7 6.9 6.9 0 3.8-3.1 6.9-6.9 6.9s-6.9-3.1-6.9-6.9c0-4.2 3.1-6.9 6.9-6.9z"
        fill={body}
      />
      <path
        d="M12 6.4c-.5-1.7.4-3.4 2.1-4.1.3 1.6-.5 3.3-2.1 4.1z"
        fill="#3DAF3A"
      />
      <path
        d="M12 6.4c.4-1.5-.6-3-2.1-3.5-.2 1.5.6 2.9 2.1 3.5z"
        fill="#2E8B2B"
      />
    </svg>
  );
}

/** Top-right "⋮" overflow menu: download, share, add to list, edit (admin). */
function DetailMenu({
  item,
  isAdmin,
  onAddToList,
  onEdit,
  onDelete,
  onIdentify,
  onPlayMix,
  onToast,
}: {
  item: BaseItemDto;
  isAdmin: boolean;
  onAddToList: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onIdentify: () => void;
  onPlayMix: () => void;
  onToast: (text: string) => void;
}) {
  const t = useTranslations("Detail");
  const [open, setOpen] = useState(false);
  const isPlayable = item.Type !== "Series";
  // InstantMix (radio) is an audio feature; it returns nothing for video items.
  const canMix = item.Type === "MusicAlbum" || item.Type === "Audio";

  async function share() {
    setOpen(false);
    const url = `${window.location.origin}/item/${item.Id}`;
    const title = item.Name ?? "JellyNext";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // User dismissed the native share sheet — not an error.
        if ((err as Error)?.name === "AbortError") return;
        // Otherwise fall through to the clipboard path.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      onToast(t("linkCopied"));
    } catch {
      onToast(t("shareFailed"));
    }
  }
  function download() {
    setOpen(false);
    window.open(`/api/jf/Items/${item.Id}/Download`, "_blank");
  }

  return (
    <div className="absolute top-6 right-8 z-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("more")}
        className="flex size-11 items-center justify-center rounded-[10px] bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
      >
        <MoreVertical className="size-5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="animate-jn-pop absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border-strong bg-bg/95 p-1.5 shadow-2xl backdrop-blur-md">
            {canMix && (
              <MenuItem
                icon={<Radio className="size-4" />}
                label={t("playMix")}
                onClick={() => {
                  setOpen(false);
                  onPlayMix();
                }}
              />
            )}
            {isPlayable && (
              <MenuItem
                icon={<Download className="size-4" />}
                label={t("download")}
                onClick={download}
              />
            )}
            <MenuItem
              icon={<Share2 className="size-4" />}
              label={t("share")}
              onClick={share}
            />
            <MenuItem
              icon={<ListPlus className="size-4" />}
              label={t("addToList")}
              onClick={() => {
                setOpen(false);
                onAddToList();
              }}
            />
            {isAdmin && (
              <MenuItem
                icon={<Pencil className="size-4" />}
                label={t("edit")}
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              />
            )}
            {isAdmin && item.Type !== "Episode" && (
              <MenuItem
                icon={<ScanSearch className="size-4" />}
                label={t("identify")}
                onClick={() => {
                  setOpen(false);
                  onIdentify();
                }}
              />
            )}
            {isAdmin && (
              <MenuItem
                icon={<Trash2 className="size-4" />}
                label={t("delete")}
                danger
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
        danger
          ? "text-danger-soft hover:bg-danger/10"
          : "text-text hover:bg-white/[0.06]",
      )}
    >
      <span className={danger ? "text-danger-soft" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}

/** Destructive confirm dialog for permanently deleting an item + its files. */
function DeleteConfirm({
  item,
  pending,
  onCancel,
  onConfirm,
}: {
  item: BaseItemDto;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Detail");
  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <div
          className="animate-jn-pop w-full max-w-[420px] rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-danger/15 text-danger-soft">
              <Trash2 className="size-5" />
            </span>
            <h3 className="text-lg font-extrabold">{t("deleteTitle")}</h3>
          </div>
          <p className="mb-5 text-[14px] leading-relaxed text-para">
            {t("deleteWarning", { name: item.Name ?? "" })}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[10px] border border-border-strong px-4 py-2.5 text-[13px] font-bold text-muted hover:bg-white/[0.06]"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-[10px] bg-danger px-5 py-2.5 text-[13px] font-extrabold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
