"use client";

import { useTranslations } from "next-intl";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { GridSkeleton } from "@/components/media/skeletons";
import { useArtistAlbums } from "@/lib/jellyfin/queries";
import { gradientFallback, posterUrl } from "@/lib/jellyfin/media";
import { AlbumCard } from "./music-cards";

export function ArtistView({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Music");
  const { data, isLoading } = useArtistAlbums(item.Id);
  const albums = data?.Items ?? [];
  const img = posterUrl(item, { maxWidth: 400 });

  return (
    <div className="animate-jn-fade px-10 pt-9 pb-24">
      <div className="mb-10 flex flex-wrap items-end gap-8">
        <span
          className="size-[180px] flex-none rounded-full bg-cover bg-center shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage: img
              ? `url("${img}"), ${gradientFallback(item.Id)}`
              : gradientFallback(item.Id),
          }}
        />
        <div>
          <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-accent">
            {t("artistLabel")}
          </div>
          <h1 className="text-5xl font-extrabold tracking-[-0.02em]">
            {item.Name}
          </h1>
        </div>
      </div>

      <h2 className="mb-4 text-xl font-bold tracking-tight">{t("albums")}</h2>
      {isLoading ? (
        <GridSkeleton count={6} />
      ) : albums.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-5">
          {albums.map((al) => (
            <AlbumCard key={al.Id} album={al} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
