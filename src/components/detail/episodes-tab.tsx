"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import {
  formatRuntime,
  gradientFallback,
  posterUrl,
  thumbUrl,
} from "@/lib/jellyfin/media";
import { useEpisodes, useSeasons } from "@/lib/jellyfin/queries";
import { CarouselSkeleton } from "@/components/media/skeletons";
import { cn } from "@/lib/utils";

export function EpisodesTab({ seriesId }: { seriesId: string }) {
  const t = useTranslations("Detail");
  const router = useRouter();
  const seasons = useSeasons(seriesId);
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
          {episodes.data.Items.map((ep) => {
            const img =
              thumbUrl(ep, { maxWidth: 320 }) ??
              posterUrl(ep, { maxWidth: 320 });
            return (
              <button
                key={ep.Id}
                type="button"
                onClick={() => router.push(`/watch/${ep.Id}`)}
                className="group flex items-center gap-[18px] rounded-xl p-3.5 text-left transition-colors hover:bg-white/[0.04]"
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
                  <div className="absolute inset-0 flex items-center justify-center bg-scrim/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-on-accent">
                      <Play className="size-4 fill-current" />
                    </span>
                  </div>
                  {ep.RunTimeTicks && (
                    <span className="absolute right-1.5 bottom-1.5 rounded bg-scrim/75 px-1.5 py-0.5 text-[10.5px] font-bold">
                      {formatRuntime(ep.RunTimeTicks)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 text-[15.5px] font-bold">
                    {ep.Name}
                  </div>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
                    {ep.Overview}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="py-10 text-center text-muted">{t("noEpisodes")}</p>
      )}
    </div>
  );
}
