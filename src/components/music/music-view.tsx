"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Music2 } from "lucide-react";
import { Carousel } from "@/components/media/carousel";
import { Skeleton } from "@/components/media/skeletons";
import { AlbumCard, ArtistAvatar } from "./music-cards";
import {
  useAlbums,
  useArtists,
  useRecentlyPlayedAlbums,
  useUserViews,
} from "@/lib/jellyfin/queries";

export function MusicView() {
  const t = useTranslations("Music");
  const views = useUserViews();
  const parentId = useMemo(
    () => views.data?.Items?.find((v) => v.CollectionType === "music")?.Id,
    [views.data],
  );

  const recent = useRecentlyPlayedAlbums(parentId);
  const artists = useArtists(parentId);
  const albums = useAlbums(parentId);

  const recentItems = recent.data?.Items ?? [];
  const artistItems = artists.data?.Items ?? [];
  const albumItems = albums.data?.Items ?? [];

  if (!views.isLoading && !parentId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-muted">
          <Music2 className="size-6" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-md text-sm text-muted">{t("noLibrary")}</p>
      </div>
    );
  }

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-24">
      <h1 className="mb-7 text-4xl font-extrabold tracking-tight">
        {t("title")}
      </h1>

      {recentItems.length > 0 && (
        <Carousel title={t("recentlyPlayed")}>
          {recentItems.map((al) => (
            <AlbumCard key={al.Id} album={al} className="w-[170px] flex-none" />
          ))}
        </Carousel>
      )}

      {artistItems.length > 0 && (
        <Carousel title={t("artists")}>
          {artistItems.map((ar) => (
            <ArtistAvatar key={ar.Id} artist={ar} label={t("artistLabel")} />
          ))}
        </Carousel>
      )}

      <h2 className="mb-4 text-xl font-bold tracking-tight">{t("albums")}</h2>
      {albums.isLoading && !albumItems.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : albumItems.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-5">
          {albumItems.map((al) => (
            <AlbumCard key={al.Id} album={al} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
