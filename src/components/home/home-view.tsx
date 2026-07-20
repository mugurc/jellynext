"use client";

import { useTranslations } from "next-intl";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Billboard } from "@/components/media/billboard";
import { MediaRow } from "@/components/media/media-row";
import {
  useGenres,
  useItemsRow,
  useLatestItems,
  useNextUp,
  useResumeItems,
  useSuggestions,
  useUserViews,
} from "@/lib/jellyfin/queries";

/** The library route a collection type maps to (for "See all"). */
const LIBRARY_HREF: Record<string, string> = {
  movies: "/movies",
  tvshows: "/tv",
  music: "/music",
  boxsets: "/my-stuff",
  playlists: "/my-stuff",
};

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
  const suggestions = useSuggestions(18);
  const favorites = useItemsRow("homeFavorites", {
    includeItemTypes: "Movie,Series",
    filters: "IsFavorite",
    sortBy: "SortName",
    limit: 18,
  });
  // Library rows (worldwide discovery lives on the /discover page).
  const newReleases = useItemsRow("newReleases", {
    includeItemTypes: "Movie,Series",
    sortBy: "PremiereDate,SortName",
    sortOrder: "Descending",
    limit: 18,
  });
  const topRated = useItemsRow("topRated", {
    includeItemTypes: "Movie,Series",
    sortBy: "CommunityRating,SortName",
    sortOrder: "Descending",
    limit: 18,
  });

  const views = useUserViews();
  // Video libraries get their own "recently added" row; boxsets/playlists don't.
  const videoLibraries = (views.data?.Items ?? []).filter(
    (v) => v.CollectionType === "movies" || v.CollectionType === "tvshows",
  );

  const featuredItems = (featured.data?.Items ?? [])
    .filter((i) => i.BackdropImageTags?.length)
    .slice(0, 5);
  const billboardItems = featuredItems.length
    ? featuredItems
    : (featured.data?.Items ?? []).slice(0, 5);

  // First movie library id drives the genre-discovery rows.
  const moviesView = (views.data?.Items ?? []).find(
    (v) => v.CollectionType === "movies",
  );

  return (
    <div className="animate-jn-fade">
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
          title={t("favorites")}
          items={favorites.data?.Items}
          isLoading={favorites.isLoading}
          seeAllHref="/my-stuff"
        />

        <MediaRow
          title={t("suggestions")}
          items={suggestions.data?.Items}
          isLoading={suggestions.isLoading}
        />

        <MediaRow
          title={t("newReleases")}
          items={newReleases.data?.Items}
          isLoading={newReleases.isLoading}
        />

        {videoLibraries.map((view) => (
          <LibraryLatestRow key={view.Id} view={view} />
        ))}

        <MediaRow
          title={t("topRated")}
          items={topRated.data?.Items}
          isLoading={topRated.isLoading}
        />

        <GenreDiscoveryRows parentId={moviesView?.Id} />
      </div>
    </div>
  );
}

/** "Recently Added in <library>" — one row per video library. */
function LibraryLatestRow({ view }: { view: BaseItemDto }) {
  const t = useTranslations("Home");
  const latest = useLatestItems(view.Id, 18);
  const href = view.CollectionType
    ? LIBRARY_HREF[view.CollectionType]
    : undefined;
  return (
    <MediaRow
      title={t("recentlyAddedIn", { library: view.Name ?? "" })}
      items={latest.data}
      isLoading={latest.isLoading}
      seeAllHref={href}
    />
  );
}

/** A few genre rows from the movie library, for discovery. */
function GenreDiscoveryRows({ parentId }: { parentId?: string }) {
  const genres = useGenres(parentId);
  const picks = (genres.data?.Items ?? [])
    .map((g) => g.Name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);
  return (
    <>
      {picks.map((genre) => (
        <GenreRow key={genre} genre={genre} parentId={parentId} />
      ))}
    </>
  );
}

function GenreRow({ genre, parentId }: { genre: string; parentId?: string }) {
  const row = useItemsRow(`genre-${genre}`, {
    parentId,
    includeItemTypes: "Movie",
    genres: genre,
    sortBy: "Random",
    limit: 18,
  });
  return (
    <MediaRow
      title={genre}
      items={row.data?.Items}
      isLoading={row.isLoading}
      seeAllHref={`/movies?genre=${encodeURIComponent(genre)}`}
    />
  );
}
