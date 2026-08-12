"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Play } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  formatRuntime,
  gradientFallback,
  posterUrl,
  resumePercent,
  thumbUrl,
} from "@/lib/jellyfin/media";
import {
  useEpisodes,
  useSeasons,
  useTogglePlayed,
} from "@/lib/jellyfin/queries";
import { CarouselSkeleton } from "@/components/media/skeletons";
import { cn } from "@/lib/utils";

function airDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

export function EpisodesTab({ seriesId }: { seriesId: string }) {
  const t = useTranslations("Detail");
  const router = useRouter();
  const seasons = useSeasons(seriesId);
  const played = useTogglePlayed();
  const [chosenSeason, setChosenSeason] = useState<string>();

  const seasonItems = seasons.data?.Items ?? [];
  const seasonId = chosenSeason ?? seasonItems[0]?.Id;
  const episodes = useEpisodes(seriesId, seasonId);

  if (seasons.isLoading) return <CarouselSkeleton variant="wide" />;

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
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-card/60" />
          ))}
        </div>
      ) : episodes.data?.Items?.length ? (
        <div className="flex flex-col gap-2">
          {episodes.data.Items.map((ep) => (
            <EpisodeRow
              key={ep.Id}
              ep={ep}
              busy={played.isPending && played.variables?.id === ep.Id}
              onOpen={() => router.push(`/item/${ep.Id}`)}
              onPlay={() => router.push(`/watch/${ep.Id}`)}
              onToggleWatched={() =>
                ep.Id &&
                played.mutate({ id: ep.Id, played: !ep.UserData?.Played })
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-muted">{t("noEpisodes")}</p>
      )}
    </div>
  );
}

function EpisodeRow({
  ep,
  busy,
  onOpen,
  onPlay,
  onToggleWatched,
}: {
  ep: BaseItemDto;
  busy: boolean;
  onOpen: () => void;
  onPlay: () => void;
  onToggleWatched: () => void;
}) {
  const t = useTranslations("Detail");
  const tc = useTranslations("Common");
  const img =
    thumbUrl(ep, { maxWidth: 320 }) ?? posterUrl(ep, { maxWidth: 320 });
  const watched = ep.UserData?.Played ?? false;
  const progress = resumePercent(ep);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
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
      <div
        className="relative aspect-video w-[172px] flex-none overflow-hidden rounded-lg bg-card bg-cover bg-center"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(ep.Id)}`
            : gradientFallback(ep.Id),
        }}
      >
        <button
          type="button"
          aria-label={tc("play")}
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="absolute inset-0 flex items-center justify-center bg-scrim/20 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-on-accent">
            <Play className="size-4 fill-current" />
          </span>
        </button>
        {watched && (
          <span className="pointer-events-none absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
            <Check className="size-3.5" />
          </span>
        )}
        {ep.RunTimeTicks && (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-scrim/75 px-1.5 py-0.5 text-[10.5px] font-bold">
            {formatRuntime(ep.RunTimeTicks)}
          </span>
        )}
        {progress > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div
              className="h-full bg-accent"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatched();
        }}
        disabled={busy}
        aria-label={watched ? t("markUnwatched") : t("markWatched")}
        title={watched ? t("markUnwatched") : t("markWatched")}
        className={cn(
          "flex size-9 flex-none items-center justify-center rounded-full border transition-colors disabled:opacity-50",
          watched
            ? "border-accent bg-accent/20 text-accent"
            : "border-border-strong text-muted opacity-0 group-hover:opacity-100 hover:border-white hover:text-bright",
        )}
      >
        <Check className="size-4" />
      </button>
    </div>
  );
}
