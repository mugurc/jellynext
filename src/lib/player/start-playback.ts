"use client";

import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "@/lib/jellyfin/browser";

/** Item types the player can be handed directly. */
export const PLAYABLE_TYPES = [
  "Movie",
  "Episode",
  "Video",
  "MusicVideo",
  "Audio",
];

export interface PlaybackTarget {
  /** The item to open in the player. */
  itemId: string;
  /** Queue to install for prev/next/autoplay, or null for single-item playback. */
  queue: { ids: string[]; title: string } | null;
}

/** The next unwatched episode of a series, if the server knows one. */
async function fetchNextUp(
  seriesId: string,
  userId: string,
): Promise<BaseItemDto | null> {
  const res = await jf
    .get<BaseItemDtoQueryResult>("/Shows/NextUp", {
      userId,
      seriesId,
      limit: 1,
    })
    .catch(() => null);
  return res?.Items?.[0] ?? null;
}

/**
 * Every episode of a series as a play queue, starting at the next unwatched one.
 *
 * A library can hold DUPLICATE items for the same episode (two files), so the
 * queue is collapsed by season+number — otherwise every episode would play
 * twice. That also means the next-up episode's own id may not be in the queue,
 * so we match it back by season+number rather than by id.
 */
async function seriesTarget(
  item: BaseItemDto,
  userId: string,
  nextUpHint?: BaseItemDto | null,
): Promise<PlaybackTarget | null> {
  const eps = await jf
    .get<BaseItemDtoQueryResult>(`/Shows/${item.Id}/Episodes`, { userId })
    .catch(() => null);
  const seen = new Set<string>();
  const unique = (eps?.Items ?? []).filter((e) => {
    const key = `${e.ParentIndexNumber}-${e.IndexNumber}`;
    if (!e.Id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = unique.map((e) => e.Id).filter((id): id is string => Boolean(id));
  if (!ids.length) return null;

  const nextUp =
    nextUpHint !== undefined ? nextUpHint : await fetchNextUp(item.Id!, userId);
  const startEp = nextUp
    ? unique.find(
        (e) =>
          e.ParentIndexNumber === nextUp.ParentIndexNumber &&
          e.IndexNumber === nextUp.IndexNumber,
      )
    : undefined;

  return {
    itemId: startEp?.Id ?? ids[0],
    queue: { ids, title: item.Name ?? "" },
  };
}

/**
 * One season's episodes as a queue, starting at its first unwatched episode.
 * NextUp is series-wide, so it cannot answer "where does THIS season resume".
 */
async function seasonTarget(
  item: BaseItemDto,
  userId: string,
): Promise<PlaybackTarget | null> {
  if (!item.SeriesId) return containerTarget(item, userId);
  const eps = await jf
    .get<BaseItemDtoQueryResult>(`/Shows/${item.SeriesId}/Episodes`, {
      userId,
      seasonId: item.Id,
      fields: "UserData",
    })
    .catch(() => null);

  // Same duplicate-file caveat as a series, keyed on the episode number alone
  // since every episode here is already in the one season.
  const seen = new Set<string>();
  const unique = (eps?.Items ?? []).filter((e) => {
    const key = String(e.IndexNumber ?? e.Id);
    if (!e.Id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = unique.map((e) => e.Id).filter((id): id is string => Boolean(id));
  if (!ids.length) return null;

  const start = unique.find((e) => !e.UserData?.Played);
  return {
    itemId: start?.Id ?? ids[0],
    queue: { ids, title: item.SeriesName ?? item.Name ?? "" },
  };
}

/** A collection's or playlist's playable children as a queue, from the top. */
async function containerTarget(
  item: BaseItemDto,
  userId: string,
): Promise<PlaybackTarget | null> {
  const isPlaylist = item.Type === "Playlist";
  const res = await jf
    .get<BaseItemDtoQueryResult>(
      isPlaylist ? `/Playlists/${item.Id}/Items` : "/Items",
      isPlaylist
        ? { userId }
        : { parentId: item.Id, userId, sortBy: "SortName" },
    )
    .catch(() => null);

  // Same duplicate-file caveat as series, but children have no season/episode
  // numbers to key on — title + year is the best available identity.
  const seen = new Set<string>();
  const ids = (res?.Items ?? [])
    .filter((c) => c.Type && PLAYABLE_TYPES.includes(c.Type))
    .filter((c) => {
      const key = `${c.Name}-${c.ProductionYear ?? ""}`;
      if (!c.Id || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => c.Id)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return null;

  return { itemId: ids[0], queue: { ids, title: item.Name ?? "" } };
}

/**
 * Work out what pressing Play on `item` should actually open.
 *
 * Containers (a series, collection or playlist) are not themselves playable —
 * handing their id to the player just yields a PlaybackInfo response with no
 * media sources and an error screen. They resolve to a real child plus the
 * queue to play through. Returns null when there is nothing playable inside,
 * so callers can fall back (e.g. to the detail page).
 *
 * `nextUpHint` lets a caller that already has the series' next-up episode skip
 * the extra request; pass `undefined` to have it fetched.
 */
export async function resolvePlaybackTarget(
  item: BaseItemDto,
  userId: string,
  nextUpHint?: BaseItemDto | null,
): Promise<PlaybackTarget | null> {
  if (!item.Id) return null;
  if (item.Type === "Series") return seriesTarget(item, userId, nextUpHint);
  if (item.Type === "Season") return seasonTarget(item, userId);
  if (item.Type === "BoxSet" || item.Type === "Playlist")
    return containerTarget(item, userId);
  return { itemId: item.Id, queue: null };
}
