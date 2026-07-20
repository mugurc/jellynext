"use client";

import { useTranslations } from "next-intl";
import { Play, Shuffle } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { GridSkeleton } from "@/components/media/skeletons";
import { useAlbumTracks } from "@/lib/jellyfin/queries";
import {
  formatClock,
  gradientFallback,
  posterUrl,
  ticksToSeconds,
} from "@/lib/jellyfin/media";
import { usePlayer, type Track } from "@/lib/player/store";

export function AlbumView({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Music");
  const playQueue = usePlayer((s) => s.playQueue);
  const { data, isLoading } = useAlbumTracks(item.Id);
  const tracks = data?.Items ?? [];

  const cover = posterUrl(item, { maxWidth: 480 });
  const artist = item.AlbumArtist ?? item.Artists?.[0] ?? "";

  const queue: Track[] = tracks.map((tk) => ({
    id: tk.Id!,
    name: tk.Name ?? "",
    artist: tk.AlbumArtist ?? tk.Artists?.[0] ?? artist,
    coverUrl: cover,
  }));

  function playAll() {
    if (queue.length) playQueue(queue, 0);
  }
  function shuffle() {
    if (!queue.length) return;
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    playQueue(shuffled, 0);
  }

  return (
    <div className="animate-jn-fade px-10 pt-9 pb-28">
      <div className="mb-9 flex flex-wrap gap-8">
        <div
          className="aspect-square w-[220px] flex-none rounded-2xl bg-cover bg-center shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage: cover
              ? `url("${cover}"), ${gradientFallback(item.Id)}`
              : gradientFallback(item.Id),
          }}
        />
        <div className="flex min-w-[260px] flex-1 flex-col justify-end">
          <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-accent">
            {t("albumLabel")}
          </div>
          <h1 className="mb-3 text-5xl font-extrabold tracking-[-0.02em]">
            {item.Name}
          </h1>
          <div className="mb-6 text-[15px] text-bright">
            {[artist, item.ProductionYear, `${tracks.length} ${t("tracks")}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={playAll}
              disabled={!queue.length}
              className="flex items-center gap-2.5 rounded-lg bg-accent px-8 py-3 text-[15px] font-extrabold text-on-accent transition hover:brightness-110 disabled:opacity-50"
            >
              <Play className="size-5 fill-current" /> {t("playAll")}
            </button>
            <button
              type="button"
              onClick={shuffle}
              disabled={!queue.length}
              className="flex items-center gap-2 rounded-lg border-[1.5px] border-bright/40 px-6 py-3 text-[14px] font-bold text-white transition hover:border-white disabled:opacity-50"
            >
              <Shuffle className="size-[18px]" /> {t("shuffle")}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : (
        <div className="flex flex-col">
          {tracks.map((tk, i) => (
            <button
              key={tk.Id}
              type="button"
              onClick={() => playQueue(queue, i)}
              className="grid grid-cols-[32px_1fr_auto] items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-center text-[14px] font-semibold text-dim">
                {tk.IndexNumber ?? i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">
                  {tk.Name}
                </span>
                <span className="block truncate text-[11.5px] text-muted">
                  {tk.AlbumArtist ?? tk.Artists?.[0] ?? artist}
                </span>
              </span>
              <span className="text-[12.5px] text-muted tabular-nums">
                {formatClock(ticksToSeconds(tk.RunTimeTicks))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
