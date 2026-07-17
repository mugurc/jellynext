"use client";

import { useTranslations } from "next-intl";
import { Billboard } from "@/components/media/billboard";
import { MediaRow } from "@/components/media/media-row";
import {
  useItemsRow,
  useLatestItems,
  useNextUp,
  useResumeItems,
} from "@/lib/jellyfin/queries";

export function HomeView() {
  const t = useTranslations("Home");

  const featured = useItemsRow("featured", {
    includeItemTypes: "Movie,Series",
    sortBy: "DateCreated",
    sortOrder: "Descending",
    limit: 12,
  });
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const latest = useLatestItems(undefined, 18);
  const trending = useItemsRow("trending", {
    includeItemTypes: "Movie,Series",
    sortBy: "CommunityRating",
    sortOrder: "Descending",
    limit: 18,
  });
  const movies = useItemsRow("moviesRow", {
    includeItemTypes: "Movie",
    sortBy: "DateCreated",
    sortOrder: "Descending",
    limit: 18,
  });
  const series = useItemsRow("seriesRow", {
    includeItemTypes: "Series",
    sortBy: "DateCreated",
    sortOrder: "Descending",
    limit: 18,
  });

  const featuredItems = (featured.data?.Items ?? [])
    .filter((i) => i.BackdropImageTags?.length)
    .slice(0, 5);
  const billboardItems = featuredItems.length
    ? featuredItems
    : (featured.data?.Items ?? []).slice(0, 5);

  return (
    <div>
      {featured.isLoading ? (
        <div className="h-[600px] animate-pulse bg-card/40" />
      ) : (
        <Billboard items={billboardItems} />
      )}

      <div className="relative -mt-8 px-10 pb-16">
        <MediaRow
          title={t("continueWatching")}
          items={resume.data?.Items}
          isLoading={resume.isLoading}
          variant="wide"
          showProgress
        />
        <MediaRow
          title={t("nextUp")}
          items={nextUp.data?.Items}
          isLoading={nextUp.isLoading}
          variant="wide"
        />
        <MediaRow
          title={t("recentlyAdded")}
          items={latest.data}
          isLoading={latest.isLoading}
        />
        <MediaRow
          title={t("trending")}
          items={trending.data?.Items}
          isLoading={trending.isLoading}
        />
        <MediaRow
          title={t("movies")}
          items={movies.data?.Items}
          isLoading={movies.isLoading}
          seeAllHref="/movies"
        />
        <MediaRow
          title={t("series")}
          items={series.data?.Items}
          isLoading={series.isLoading}
          seeAllHref="/tv"
        />
      </div>
    </div>
  );
}
