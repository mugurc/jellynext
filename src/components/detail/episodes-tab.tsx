"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Play } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  formatRuntime,
  posterUrl,
  resumePercent,
  thumbUrl,
} from "@/lib/jellyfin/media";
import { useEpisodes, useSeasons } from "@/lib/jellyfin/queries";
import { Art } from "@/components/common/art";
import { CardActions } from "@/components/media/card-actions";
import { ListSkeleton } from "@/components/media/skeletons";
import { cn } from "@/lib/utils";

function airDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

/**
 * A series' episode list, or one season's when `seasonId` is pinned — a season
 * page has no other season to switch to, so it skips the picker and the
 * request behind it.
 */
export function EpisodesTab({
  seriesId,
  seasonId: pinnedSeason,
}: {
  seriesId: string;
  seasonId?: string;
}) {
  const t = useTranslations("Detail");
  const router = useRouter();
  const seasons = useSeasons(pinnedSeason ? undefined : seriesId);
  const [chosenSeason, setChosenSeason] = useState<string>();

  const seasonItems = seasons.data?.Items ?? [];
  // Specials come back as season 0 and the server lists them first, so the
  // Episodes tab — the default tab for a series — opened on Specials. Prefer
  // the first numbered season; fall back to whatever is there.
  const firstReal =
    seasonItems.find((s) => (s.IndexNumber ?? 0) > 0) ?? seasonItems[0];
  const seasonId = pinnedSeason ?? chosenSeason ?? firstReal?.Id;
  const episodes = useEpisodes(seriesId, seasonId);

  if (!pinnedSeason && seasons.isLoading) return <EpisodeListSkeleton />;

  return (
    <div>
      {seasonItems.length > 1 && (
        <div className="mb-5 inline-flex gap-1.5 rounded-[9px] bg-white/[0.04] p-1">
          {seasonItems.map((s) => (
            <button
              key={s.Id}
              type="button"
              onClick={() => setChosenSeason(s.Id!)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                seasonId === s.Id
                  ? "bg-accent text-on-accent"
                  : "text-bright hover:bg-white/[0.06]",
              )}
            >
              {s.Name ?? `${t("season")} ${s.IndexNumber}`}
            </button>
          ))}
        </div>
      )}

      {episodes.isLoading ? (
        <EpisodeListSkeleton />
      ) : episodes.data?.Items?.length ? (
        <div className="flex flex-col gap-2">
          {episodes.data.Items.map((ep) => (
            <EpisodeRow
              key={ep.Id}
              ep={ep}
              onOpen={() => router.push(`/item/${ep.Id}`)}
              onPlay={() => router.push(`/watch/${ep.Id}`)}
            />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-muted">{t("noEpisodes")}</p>
      )}
    </div>
  );
}

/**
 * Built from the same parts as EpisodeRow rather than from a guessed height, so
 * the two are the same size by construction — the row's height comes from its
 * 16:9 thumbnail, which a flat `h-24` block was 29px short of.
 */
function EpisodeListSkeleton() {
  return (
    <ListSkeleton
      count={5}
      leading="size-6"
      thumb="aspect-video w-[172px] rounded-token"
      lines={3}
      rowClassName="flex items-center gap-[18px] p-3.5"
      className="flex flex-col gap-2"
    />
  );
}

function EpisodeRow({
  ep,
  onOpen,
  onPlay,
}: {
  ep: BaseItemDto;
  onOpen: () => void;
  onPlay: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("Card");
  const img =
    thumbUrl(ep, { maxWidth: 320 }) ?? posterUrl(ep, { maxWidth: 320 });
  const progress = resumePercent(ep);
  // A string, so an empty one renders nothing — where a bare `ticks &&` would
  // both print a literal 0 and paint an empty pill over the thumbnail.
  const runtime = formatRuntime(ep.RunTimeTicks, locale);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Only the row itself. Space and Enter on the play/favourite/watched
        // controls inside it are theirs, and would otherwise also navigate.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer items-center gap-[18px] rounded-xl p-3.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <div className="w-6 flex-none text-center text-xl font-extrabold text-dim">
        {ep.IndexNumber}
      </div>
      {/* An episode row is a media card lying down, so it wears the same hover
          language: one wash, a centred play button, and the shared action row
          that carries favourite / watched / overflow everywhere else. */}
      <Art
        src={img}
        seed={ep.Id}
        className="aspect-video w-[172px] flex-none rounded-token bg-card"
      >
        <div className="absolute inset-0 bg-scrim/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100" />

        <div className="jn-hover-reveal pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200">
          <button
            type="button"
            aria-label={t("playItem", { title: ep.Name ?? "" })}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-white/95 text-on-accent shadow-lg transition-transform duration-200 hover:scale-105"
          >
            <Play className="size-5 translate-x-px fill-current" />
          </button>
        </div>

        <CardActions item={ep} playable />

        {runtime && (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-scrim/75 px-1.5 py-0.5 text-[10.5px] font-bold">
            {runtime}
          </span>
        )}
        {progress > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </Art>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="truncate text-[15.5px] font-bold">{ep.Name}</span>
          {airDate(ep.PremiereDate) && (
            <span className="flex-none text-[11.5px] text-dim">
              {airDate(ep.PremiereDate)}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
          {ep.Overview}
        </p>
      </div>
    </div>
  );
}
