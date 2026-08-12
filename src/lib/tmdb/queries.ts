"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "@/lib/jellyfin/browser";
import { useCurrentUser } from "@/lib/auth/current-user";

const IMG = "https://image.tmdb.org/t/p";

/** Full TMDb image URL, or null. size e.g. w500 / w780 / original / w185. */
export function tmdbImage(
  path: string | null | undefined,
  size = "w500",
): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

export interface TmdbItem {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
}

/** Display title / year regardless of movie vs tv shape. */
export function tmdbTitle(i: TmdbItem): string {
  return i.title ?? i.name ?? "";
}
export function tmdbYear(i: TmdbItem): string {
  return (i.release_date ?? i.first_air_date ?? "").slice(0, 4);
}
export function tmdbType(i: TmdbItem): "movie" | "tv" {
  return i.media_type ?? (i.title ? "movie" : "tv");
}

interface TmdbListResponse {
  results?: TmdbItem[];
}

async function fetchTmdb<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/tmdb/${path}`);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** A TMDb discovery list (trending / now_playing / popular…). */
function useTmdbList(key: string, path: string, mediaType?: "movie" | "tv") {
  return useQuery({
    queryKey: ["tmdbList", key],
    queryFn: async () => {
      const data = await fetchTmdb<TmdbListResponse>(path);
      return (data?.results ?? [])
        .filter((r) => (r.poster_path || r.backdrop_path) && tmdbTitle(r))
        .map((r) => ({ ...r, media_type: r.media_type ?? mediaType }));
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** Globally trending (movies + TV) this week. */
export function useTmdbTrending() {
  return useTmdbList("trending", "trending/all/week");
}

/** Movies in theatres now / just released. */
export function useTmdbNowPlaying() {
  return useTmdbList("nowPlaying", "movie/now_playing?language=en-US", "movie");
}

/** Popular TV shows right now. */
export function useTmdbPopularTv() {
  return useTmdbList("popularTv", "tv/popular?language=en-US", "tv");
}

/** Popular movies right now. */
export function useTmdbPopularMovies() {
  return useTmdbList("popularMovies", "movie/popular?language=en-US", "movie");
}

/** Highest-rated movies of all time. */
export function useTmdbTopRatedMovies() {
  return useTmdbList(
    "topRatedMovies",
    "movie/top_rated?language=en-US",
    "movie",
  );
}

/** Upcoming / soon-to-release movies. */
export function useTmdbUpcoming() {
  return useTmdbList("upcoming", "movie/upcoming?language=en-US", "movie");
}

/** Trending TV shows this week. */
export function useTmdbTrendingTv() {
  return useTmdbList("trendingTv", "trending/tv/week", "tv");
}

// ── Detail ───────────────────────────────────────────────────────────

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}
export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name?: string;
  official?: boolean;
}
export interface TmdbLogo {
  file_path: string;
  iso_639_1?: string | null;
}
export interface TmdbImages {
  logos?: TmdbLogo[];
}
export interface TmdbDetail extends TmdbItem {
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  tagline?: string;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  production_countries?: { name: string }[];
  homepage?: string;
  imdb_id?: string;
  external_ids?: { imdb_id?: string };
  credits?: { cast?: TmdbCastMember[] };
  videos?: { results?: TmdbVideo[] };
  images?: TmdbImages;
}

/** Best title logo from a TMDb images block (English preferred, then neutral). */
export function tmdbLogo(
  images: TmdbImages | null | undefined,
  size = "w500",
): string | null {
  const logos = images?.logos ?? [];
  if (!logos.length) return null;
  const pick =
    logos.find((l) => l.iso_639_1 === "en") ??
    logos.find((l) => !l.iso_639_1) ??
    logos[0];
  return tmdbImage(pick.file_path, size);
}

/** Best YouTube trailer URL for a TMDb detail (official Trailer > Teaser). */
export function tmdbTrailerUrl(
  item: TmdbDetail | null | undefined,
): string | null {
  const vids = (item?.videos?.results ?? []).filter(
    (v) => v.site === "YouTube" && v.key,
  );
  if (!vids.length) return null;
  const rank = (v: TmdbVideo) =>
    (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) +
    (v.official ? 0 : 0.5);
  const best = [...vids].sort((a, b) => rank(a) - rank(b))[0];
  return `https://www.youtube.com/watch?v=${best.key}`;
}

/** Full detail for a TMDb movie or TV show (with cast + videos + images + ids). */
export function useTmdbDetail(type: string, id: string) {
  return useQuery({
    queryKey: ["tmdbDetail", type, id],
    queryFn: () =>
      fetchTmdb<TmdbDetail>(
        `${type}/${id}?language=en-US&append_to_response=credits,videos,external_ids,images&include_image_language=en,null`,
      ),
    enabled: (type === "movie" || type === "tv") && Boolean(id),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** Just the title logos for a TMDb title (for the discovery billboard hero). */
export function useTmdbImages(type: string, id: string | number | undefined) {
  return useQuery({
    queryKey: ["tmdbImages", type, id],
    queryFn: () =>
      fetchTmdb<TmdbImages>(
        `${type}/${id}/images?include_image_language=en,null`,
      ),
    enabled: (type === "movie" || type === "tv") && Boolean(id),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** The library item matching a TMDb id, if the user owns it. */
export function useLibraryMatch(tmdbId: string | number | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["libraryTmdbIndex", userId],
    queryFn: async () => {
      const res = await jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        includeItemTypes: "Movie,Series",
        recursive: true,
        hasTmdbId: true,
        fields: "ProviderIds",
        limit: 5000,
      });
      const map: Record<string, BaseItemDto> = {};
      for (const item of res.Items ?? []) {
        const t = item.ProviderIds?.Tmdb;
        if (t && !map[t]) map[t] = item;
      }
      return map;
    },
    staleTime: 30 * 60 * 1000,
    select: (map) => (tmdbId != null ? map[String(tmdbId)] : undefined),
  });
}
