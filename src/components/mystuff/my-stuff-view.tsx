"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";
import { useLibraryItems, type ItemsParams } from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

const TABS: { key: string; params: ItemsParams }[] = [
  {
    key: "favorites",
    params: {
      filters: "IsFavorite",
      includeItemTypes: "Movie,Series,Episode,MusicAlbum",
      sortBy: "SortName",
      sortOrder: "Ascending",
    },
  },
  {
    key: "collections",
    params: {
      includeItemTypes: "BoxSet",
      sortBy: "SortName",
      sortOrder: "Ascending",
    },
  },
  {
    key: "playlists",
    params: {
      includeItemTypes: "Playlist",
      sortBy: "SortName",
      sortOrder: "Ascending",
    },
  },
];

export function MyStuffView() {
  const t = useTranslations("MyStuff");
  const tn = useTranslations("Nav");
  const [tab, setTab] = useState(TABS[0].key);

  const active = TABS.find((x) => x.key === tab)!;
  const query = useLibraryItems({ ...active.params, limit: 100 });
  const items = query.data?.Items ?? [];

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-16">
      <h1 className="mb-5 text-4xl font-extrabold tracking-tight">
        {tn("mystuff")}
      </h1>

      <div className="mb-7 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "relative -mb-px px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === x.key ? "text-text" : "text-muted hover:text-bright",
            )}
          >
            {t(x.key)}
            {tab === x.key && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {query.isLoading && !items.length ? (
        <GridSkeleton />
      ) : items.length ? (
        <div className="jn-stagger grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
          {items.map((item) => (
            <MediaCard key={item.Id} item={item} showRating={false} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
