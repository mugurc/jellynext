"use client";

import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
} from "@jellyfin/sdk/lib/generated-client";
import { jf, type Query } from "./browser";
import { useCurrentUser } from "@/lib/auth/current-user";

const LIST_FIELDS =
  "PrimaryImageAspectRatio,Overview,Genres,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,MediaSourceCount,UserData";
const IMAGE_TYPES = "Primary,Backdrop,Thumb,Logo";

export interface ItemsParams {
  parentId?: string;
  includeItemTypes?: string;
  sortBy?: string;
  sortOrder?: "Ascending" | "Descending";
  filters?: string;
  genres?: string;
  years?: string;
  recursive?: boolean;
  startIndex?: number;
  limit?: number;
  searchTerm?: string;
}

function itemsQuery(userId: string, params: ItemsParams): Query {
  return {
    userId,
    recursive: params.recursive ?? true,
    includeItemTypes: params.includeItemTypes,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    filters: params.filters,
    genres: params.genres,
    years: params.years,
    parentId: params.parentId,
    searchTerm: params.searchTerm,
    startIndex: params.startIndex,
    limit: params.limit,
    fields: LIST_FIELDS,
    imageTypeLimit: 1,
    enableImageTypes: IMAGE_TYPES,
  };
}

/** Top-level user libraries (Movies, TV Shows, Music, …). */
export function useUserViews() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["userViews", userId],
    queryFn: () => jf.get<BaseItemDtoQueryResult>("/UserViews", { userId }),
    staleTime: 10 * 60 * 1000,
  });
}

/** Continue Watching (resumable video items). */
export function useResumeItems(limit = 16) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["resume", userId, limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/UserItems/Resume", {
        userId,
        limit,
        mediaTypes: "Video",
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
  });
}

/** Next Up across in-progress series. */
export function useNextUp(limit = 16) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["nextUp", userId, limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Shows/NextUp", {
        userId,
        limit,
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
  });
}

/** Recently Added (optionally scoped to a library). */
export function useLatestItems(parentId?: string, limit = 16) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["latest", userId, parentId ?? "all", limit],
    queryFn: () =>
      jf.get<BaseItemDto[]>("/Items/Latest", {
        userId,
        parentId,
        limit,
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
  });
}

/** Generic items query for home rows. */
export function useItemsRow(key: string, params: ItemsParams, enabled = true) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["itemsRow", key, userId, params],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", itemsQuery(userId, params)),
    enabled,
  });
}

/** Paginated items for a library grid (keeps previous page while loading). */
export function useLibraryItems(params: ItemsParams, enabled = true) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["library", userId, params],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", itemsQuery(userId, params)),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Full detail for a single item. */
export function useItem(
  itemId: string | undefined,
  options?: Partial<UseQueryOptions<BaseItemDto>>,
) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["item", userId, itemId],
    queryFn: () => jf.get<BaseItemDto>(`/Users/${userId}/Items/${itemId}`),
    enabled: Boolean(itemId),
    ...options,
  });
}

export function useSeasons(seriesId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["seasons", userId, seriesId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(`/Shows/${seriesId}/Seasons`, {
        userId,
        fields: LIST_FIELDS,
      }),
    enabled: Boolean(seriesId),
  });
}

export function useEpisodes(
  seriesId: string | undefined,
  seasonId: string | undefined,
) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["episodes", userId, seriesId, seasonId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(`/Shows/${seriesId}/Episodes`, {
        userId,
        seasonId,
        fields: "Overview,PrimaryImageAspectRatio,RunTimeTicks,UserData",
        imageTypeLimit: 1,
        enableImageTypes: "Primary,Thumb",
      }),
    enabled: Boolean(seriesId && seasonId),
  });
}

export function useSimilarItems(itemId: string | undefined, limit = 12) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["similar", userId, itemId, limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(`/Items/${itemId}/Similar`, {
        userId,
        limit,
        fields: LIST_FIELDS,
      }),
    enabled: Boolean(itemId),
  });
}

export function useGenres(parentId?: string) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["genres", userId, parentId ?? "all"],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Genres", { userId, parentId }),
    staleTime: 30 * 60 * 1000,
  });
}
