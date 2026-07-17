"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Play, Plus, Share2, Star } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { itemImageUrl } from "@/lib/jellyfin/browser";
import {
  backdropUrl,
  formatClock,
  formatRuntime,
  gradientFallback,
  resumePercent,
  ticksToSeconds,
} from "@/lib/jellyfin/media";
import { useItem, useSimilarItems } from "@/lib/jellyfin/queries";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import { EpisodesTab } from "./episodes-tab";
import { DetailsTab } from "./details-tab";
import { cn } from "@/lib/utils";

type TabKey = "episodes" | "related" | "details" | "cast";

export function DetailView({ itemId }: { itemId: string }) {
  const t = useTranslations("Detail");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { data: item, isLoading } = useItem(itemId);

  const isSeries = item?.Type === "Series";
  const [tab, setTab] = useState<TabKey>("details");

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

  const backdrop = backdropUrl(item, { maxWidth: 1600 });
  const resume = resumePercent(item);
  const tabs: TabKey[] = isSeries
    ? ["episodes", "related", "details", "cast"]
    : ["related", "details", "cast"];
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const tabLabel: Record<TabKey, string> = {
    episodes: t("tabEpisodes"),
    related: t("tabRelated"),
    details: t("tabDetails"),
    cast: t("tabCast"),
  };

  function play() {
    if (isSeries) setTab("episodes");
    else router.push(`/watch/${item!.Id}`);
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

        <div className="relative max-w-[680px] px-10 pb-11">
          <div className="mb-3.5 text-[12.5px] font-semibold text-muted">
            {isSeries ? "Series" : "Movie"}
          </div>
          <h1 className="mb-4 text-[52px] leading-none font-extrabold tracking-[-0.03em] text-balance">
            {item.Name}
          </h1>
          <div className="mb-[18px] flex flex-wrap items-center gap-3 text-[13.5px] font-semibold text-bright">
            {item.CommunityRating != null && (
              <span className="flex items-center gap-1.5 text-accent">
                <Star className="size-4 fill-current" />
                {item.CommunityRating.toFixed(1)}
              </span>
            )}
            {item.ProductionYear && <span>{item.ProductionYear}</span>}
            {item.RunTimeTicks && (
              <span>{formatRuntime(item.RunTimeTicks)}</span>
            )}
            {item.OfficialRating && (
              <span className="rounded border border-bright/40 px-1.5 text-[11.5px]">
                {item.OfficialRating}
              </span>
            )}
          </div>
          {item.Overview && (
            <p className="mb-6 max-w-[600px] text-[15.5px] leading-relaxed text-pretty text-para">
              {item.Overview}
            </p>
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
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] px-5 py-3.5 text-[14.5px] font-bold text-white transition hover:border-white"
            >
              <Plus className="size-5" /> {t("watchlist")}
            </button>
            <button
              type="button"
              aria-label={t("download")}
              className="flex size-[50px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
            >
              <Download className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t("share")}
              className="flex size-[50px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
            >
              <Share2 className="size-5" />
            </button>
          </div>
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

  return (
    <div>
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
