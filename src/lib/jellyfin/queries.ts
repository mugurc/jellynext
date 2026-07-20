"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
  DisplayPreferencesDto,
  PlaylistUserPermissions,
  UpdatePlaylistDto,
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
  officialRatings?: string;
  tags?: string;
  studios?: string;
  nameStartsWith?: string;
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
    officialRatings: params.officialRatings,
    tags: params.tags,
    studios: params.studios,
    nameStartsWith: params.nameStartsWith,
    parentId: params.parentId,
    searchTerm: params.searchTerm,
    startIndex: params.startIndex,
    limit: params.limit,
    fields: LIST_FIELDS,
    imageTypeLimit: 1,
    enableImageTypes: IMAGE_TYPES,
  };
}

/** Available filter facets (genres, years, official ratings, tags) for a view. */
export interface ItemFilters {
  Genres?: string[];
  Tags?: string[];
  OfficialRatings?: string[];
  Years?: number[];
}

export function useItemFilters(
  parentId: string | undefined,
  includeItemTypes: string,
) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["itemFilters", userId, parentId, includeItemTypes],
    queryFn: () =>
      jf.get<ItemFilters>("/Items/Filters", {
        userId,
        parentId,
        includeItemTypes,
      }),
    enabled: Boolean(parentId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Studios present in a library view, for the studio filter. */
export function useStudios(parentId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["studios", userId, parentId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Studios", {
        userId,
        parentId,
        sortBy: "SortName",
        limit: 200,
      }),
    enabled: Boolean(parentId),
    staleTime: 5 * 60 * 1000,
  });
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

/** Full-text item search, scoped to the given item types. */
export function useSearch(term: string, includeItemTypes: string) {
  const { userId } = useCurrentUser();
  const query = term.trim();
  return useQuery({
    queryKey: ["search", userId, query, includeItemTypes],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(
        "/Items",
        itemsQuery(userId, {
          searchTerm: query,
          includeItemTypes,
          sortBy: "SortName",
          sortOrder: "Ascending",
          limit: 48,
        }),
      ),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}

// ── Music ────────────────────────────────────────────────────────────

/** Music albums in a library (or all), for the Music grid. */
export function useAlbums(parentId?: string, limit = 60) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["albums", userId, parentId ?? "all", limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(
        "/Items",
        itemsQuery(userId, {
          parentId,
          includeItemTypes: "MusicAlbum",
          sortBy: "SortName",
          sortOrder: "Ascending",
          limit,
        }),
      ),
    enabled: Boolean(parentId),
  });
}

/** Recently played albums (falls back to empty when nothing has been played). */
export function useRecentlyPlayedAlbums(parentId?: string, limit = 12) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["recentAlbums", userId, parentId ?? "all", limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(
        "/Items",
        itemsQuery(userId, {
          parentId,
          includeItemTypes: "MusicAlbum",
          filters: "IsPlayed",
          sortBy: "DatePlayed,SortName",
          sortOrder: "Descending",
          limit,
        }),
      ),
    enabled: Boolean(parentId),
  });
}

/** Music artists in a library. */
export function useArtists(parentId?: string, limit = 24) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["artists", userId, parentId ?? "all", limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Artists", {
        userId,
        parentId,
        limit,
        sortBy: "SortName",
        sortOrder: "Ascending",
        fields: "PrimaryImageAspectRatio",
        imageTypeLimit: 1,
        enableImageTypes: "Primary",
      }),
    enabled: Boolean(parentId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Tracks of an album, in disc/track order. */
export function useAlbumTracks(albumId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["albumTracks", userId, albumId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        parentId: albumId,
        includeItemTypes: "Audio",
        sortBy: "ParentIndexNumber,IndexNumber,SortName",
        sortOrder: "Ascending",
        fields: "ParentId",
      }),
    enabled: Boolean(albumId),
  });
}

/** Albums credited to an artist. */
export function useArtistAlbums(artistId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["artistAlbums", userId, artistId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        albumArtistIds: artistId,
        includeItemTypes: "MusicAlbum",
        recursive: true,
        sortBy: "PremiereDate,ProductionYear,SortName",
        sortOrder: "Descending",
        fields: "PrimaryImageAspectRatio,ProductionYear",
      }),
    enabled: Boolean(artistId),
  });
}

// ── Live TV ──────────────────────────────────────────────────────────

/** Live TV channels with their current program (empty when Live TV is off). */
export function useLiveChannels() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["liveChannels", userId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/LiveTv/Channels", {
        userId,
        limit: 300,
        addCurrentProgram: true,
        fields: "PrimaryImageAspectRatio",
        imageTypeLimit: 1,
        enableImageTypes: "Primary",
      }),
    staleTime: 60 * 1000,
  });
}

/** Live TV recordings. */
export function useLiveRecordings() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["liveRecordings", userId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/LiveTv/Recordings", {
        userId,
        fields: "PrimaryImageAspectRatio",
        imageTypeLimit: 1,
        enableImageTypes: "Primary,Thumb",
      }),
  });
}

/** People matching a search term (for the search "People" row). */
export function useSearchPeople(term: string, limit = 12) {
  const { userId } = useCurrentUser();
  const query = term.trim();
  return useQuery({
    queryKey: ["searchPeople", userId, query, limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Persons", {
        userId,
        searchTerm: query,
        limit,
        fields: "PrimaryImageAspectRatio",
        imageTypeLimit: 1,
        enableImageTypes: "Primary",
      }),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}

// ── Item editing (admin) ─────────────────────────────────────────────

/** Update an item's metadata (admin). Body must be the full BaseItemDto. */
export function useUpdateItem() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: ({ id, item }: { id: string; item: BaseItemDto }) =>
      jf.post(`/Items/${id}`, item),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["item", userId, v.id] });
      invalidateItemLists(qc);
    },
  });
}

/** Permanently delete an item and its file(s) (admin). */
export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jf.delete(`/Items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item"] }),
  });
}

/** Re-scan an item's metadata/images from providers (admin). */
export function useRefreshItem() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: (id: string) =>
      jf.post(`/Items/${id}/Refresh`, undefined, {
        Recursive: true,
        ImageRefreshMode: "FullRefresh",
        MetadataRefreshMode: "FullRefresh",
        ReplaceAllImages: false,
        ReplaceAllMetadata: false,
      }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["item", userId, id] });
      invalidateItemLists(qc);
    },
  });
}

/** An instant mix (radio) seeded from an item — ordered similar/related items. */
export function useInstantMix(itemId: string | undefined, enabled = true) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["instantMix", userId, itemId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(`/Items/${itemId}/InstantMix`, {
        userId,
        limit: 50,
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
    enabled: Boolean(itemId) && enabled,
    staleTime: 60 * 1000,
  });
}

// ── Identify (re-match metadata from a provider) ─────────────────────

export interface RemoteSearchResult {
  Name?: string;
  ProductionYear?: number;
  SearchProviderName?: string;
  ImageUrl?: string;
  Overview?: string;
  ProviderIds?: Record<string, string>;
  PremiereDate?: string;
}

/** Search external providers for a better metadata match for an item. */
export function useIdentifySearch() {
  return useMutation({
    mutationFn: ({
      itemType,
      name,
      year,
    }: {
      itemType: string;
      name: string;
      year?: number;
    }) =>
      jf.post<RemoteSearchResult[]>(`/Items/RemoteSearch/${itemType}`, {
        SearchInfo: { Name: name, Year: year ?? null },
      }),
  });
}

/** Apply a chosen provider match to an item (re-fetches its metadata). */
export function useApplyIdentify() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: ({
      itemId,
      result,
    }: {
      itemId: string;
      result: RemoteSearchResult;
    }) => jf.post(`/Items/RemoteSearch/Apply/${itemId}`, result),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["item", userId, v.itemId] });
      invalidateItemLists(qc);
    },
  });
}

// ── User item state (favorite / played / extras) ─────────────────────

/** Toggle an item's favorite flag. */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      favorite
        ? jf.post(`/Users/${userId}/FavoriteItems/${id}`)
        : jf.delete(`/Users/${userId}/FavoriteItems/${id}`),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["item", userId, v.id] }),
  });
}

/** Toggle an item's played (watched) flag. */
export function useTogglePlayed() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: ({ id, played }: { id: string; played: boolean }) =>
      played
        ? jf.post(`/Users/${userId}/PlayedItems/${id}`)
        : jf.delete(`/Users/${userId}/PlayedItems/${id}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["item", userId, v.id] });
      // Episode lists / next-up reflect watched state too.
      qc.invalidateQueries({ queryKey: ["episodes"] });
      qc.invalidateQueries({ queryKey: ["seriesNextUp"] });
      qc.invalidateQueries({ queryKey: ["nextUp"] });
    },
  });
}

/** An item's special features / extras (behind the scenes, deleted scenes…). */
export function useSpecialFeatures(itemId: string | undefined, enabled = true) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["specialFeatures", userId, itemId],
    queryFn: () =>
      jf.get<BaseItemDto[]>(`/Users/${userId}/Items/${itemId}/SpecialFeatures`),
    enabled: Boolean(itemId) && enabled,
  });
}

/** The next unwatched episode of a series. */
export function useSeriesNextUp(seriesId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["seriesNextUp", userId, seriesId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Shows/NextUp", {
        userId,
        seriesId,
        limit: 1,
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: "Primary,Thumb",
      }),
    enabled: Boolean(seriesId),
  });
}

// ── Collections & playlists ──────────────────────────────────────────

/** Existing collections (BoxSets). */
export function useCollectionsList() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["collectionsList", userId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        includeItemTypes: "BoxSet",
        recursive: true,
        sortBy: "SortName",
      }),
    staleTime: 60 * 1000,
  });
}

/** Existing playlists. */
export function usePlaylistsList() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["playlistsList", userId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        includeItemTypes: "Playlist",
        recursive: true,
        sortBy: "SortName",
      }),
    staleTime: 60 * 1000,
  });
}

/** Add an item to an existing collection, or create one containing it. */
export function useAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      name,
      itemId,
    }: {
      collectionId?: string;
      name?: string;
      itemId: string;
    }) =>
      collectionId
        ? jf.post(`/Collections/${collectionId}/Items`, undefined, {
            ids: itemId,
          })
        : jf.post("/Collections", undefined, { name, ids: itemId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collectionsList"] }),
  });
}

/** Add an item to an existing playlist, or create one containing it. */
export function useAddToPlaylist() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: ({
      playlistId,
      name,
      itemId,
    }: {
      playlistId?: string;
      name?: string;
      itemId: string;
    }) =>
      playlistId
        ? jf.post(`/Playlists/${playlistId}/Items`, undefined, {
            ids: itemId,
            userId,
          })
        : jf.post("/Playlists", undefined, { name, ids: itemId, userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlistsList"] }),
  });
}

// ── Collection / playlist detail management ──────────────────────────

/** Children of a collection (BoxSet). */
export function useCollectionItems(collectionId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["collectionItems", userId, collectionId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        parentId: collectionId,
        sortBy: "SortName",
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
    enabled: Boolean(collectionId),
  });
}

/** Ordered items of a playlist (each carries a PlaylistItemId for edits). */
export function usePlaylistItems(playlistId: string | undefined) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["playlistItems", userId, playlistId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>(`/Playlists/${playlistId}/Items`, {
        userId,
        fields: LIST_FIELDS,
        imageTypeLimit: 1,
        enableImageTypes: IMAGE_TYPES,
      }),
    enabled: Boolean(playlistId),
  });
}

/** Remove an item from a collection. */
export function useRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      itemId,
    }: {
      collectionId: string;
      itemId: string;
    }) => jf.delete(`/Collections/${collectionId}/Items`, { ids: itemId }),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({
        queryKey: ["collectionItems", undefined, v.collectionId],
      }),
    onSettled: () =>
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "collectionItems",
      }),
  });
}

/** Remove an entry from a playlist (by its PlaylistItemId). */
export function useRemoveFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      entryId,
    }: {
      playlistId: string;
      entryId: string;
    }) => jf.delete(`/Playlists/${playlistId}/Items`, { entryIds: entryId }),
    onSettled: () =>
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "playlistItems",
      }),
  });
}

/** Reorder a playlist entry to a new index. */
export function useMovePlaylistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      entryId,
      newIndex,
    }: {
      playlistId: string;
      entryId: string;
      newIndex: number;
    }) => jf.post(`/Playlists/${playlistId}/Items/${entryId}/Move/${newIndex}`),
    onSettled: () =>
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "playlistItems",
      }),
  });
}

// ── Item images (admin) ──────────────────────────────────────────────

export interface RemoteImage {
  Url?: string | null;
  ProviderName?: string | null;
  Width?: number | null;
  Height?: number | null;
  Type?: string | null;
  Language?: string | null;
}

/** Provider images available for an item (type = Primary, Backdrop, Logo…). */
export function useRemoteImages(
  itemId: string | undefined,
  type: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["remoteImages", itemId, type],
    queryFn: () =>
      jf.get<{ Images?: RemoteImage[]; TotalRecordCount?: number }>(
        `/Items/${itemId}/RemoteImages`,
        { type, limit: 24, includeAllLanguages: false },
      ),
    enabled: Boolean(itemId) && enabled,
    staleTime: 60 * 1000,
  });
}

/** Set an item's image by downloading a provider image URL. */
export function useDownloadRemoteImage() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: async ({
      itemId,
      type,
      imageUrl,
      currentCount,
    }: {
      itemId: string;
      type: string;
      imageUrl: string;
      /** Existing images of this type — for indexed types (Backdrop), the new
       *  image appends at this index and must be moved to the front. */
      currentCount?: number;
    }) => {
      await jf.post(`/Items/${itemId}/RemoteImages/Download`, undefined, {
        type,
        imageUrl,
      });
      // Backdrop/Art are multi-image (indexed): a download APPENDS, so the UI
      // (which shows index 0) wouldn't change. Move the new one to the front.
      if ((type === "Backdrop" || type === "Art") && currentCount) {
        await jf
          .post(
            `/Items/${itemId}/Images/${type}/${currentCount}/Index`,
            undefined,
            { newIndex: 0 },
          )
          .catch(() => {});
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["item", userId, v.itemId] });
      // Poster/backdrop change should refresh anywhere the item's card shows.
      invalidateItemLists(qc);
    },
  });
}

/** Invalidate every list/row query that renders item cards (posters/backdrops). */
function invalidateItemLists(qc: ReturnType<typeof useQueryClient>) {
  const keys = [
    "library",
    "itemsRow",
    "latest",
    "resume",
    "nextUp",
    "seriesNextUp",
    "episodes",
    "collectionItems",
    "similar",
    "search",
  ];
  qc.invalidateQueries({
    predicate: (q) => keys.includes(q.queryKey[0] as string),
  });
}

// ── Current user profile (avatar) ────────────────────────────────────

interface MeDto {
  Id?: string;
  Name?: string;
  PrimaryImageTag?: string;
}

/** The signed-in user's own profile (for the avatar tag). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => jf.get<MeDto>("/Users/Me"),
    staleTime: 60 * 1000,
  });
}

/** Upload a new avatar for the current user (base64 body, image/* type). */
export function useUploadAvatar() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
      const res = await fetch(`/api/jf/UserImage?userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/png" },
        body: btoa(binary),
      });
      if (!res.ok) throw new Error("avatar upload failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

/** Remove the current user's avatar. */
export function useDeleteAvatar() {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: () => jf.delete(`/UserImage`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// ── Personalized suggestions (home) ──────────────────────────────────

/** Server-computed "suggested for you" items. */
export function useSuggestions(limit = 12) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["suggestions", userId, limit],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items/Suggestions", {
        userId,
        limit,
        type: "Movie,Series",
        enableImageTypes: IMAGE_TYPES,
        fields: LIST_FIELDS,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Playlist management (rename / share / delete) ────────────────────

export interface PlaylistDetail {
  OpenAccess?: boolean;
  Shares?: PlaylistUserPermissions[];
  ItemIds?: string[];
}

/** A playlist's sharing settings (public flag + shared users). */
export function usePlaylist(playlistId: string | undefined) {
  return useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => jf.get<PlaylistDetail>(`/Playlists/${playlistId}`),
    enabled: Boolean(playlistId),
  });
}

/** Rename a playlist or toggle its public/private visibility. */
export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      body,
    }: {
      playlistId: string;
      body: UpdatePlaylistDto;
    }) => jf.post(`/Playlists/${playlistId}`, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["playlistsList"] });
      qc.invalidateQueries({ queryKey: ["playlist", v.playlistId] });
    },
  });
}

/** Delete a playlist entirely. */
export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => jf.delete(`/Items/${playlistId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlistsList"] }),
  });
}

/** Users a playlist is shared with (owner only). */
export function usePlaylistUsers(playlistId: string | undefined) {
  return useQuery({
    queryKey: ["playlistUsers", playlistId],
    queryFn: () =>
      jf.get<PlaylistUserPermissions[]>(`/Playlists/${playlistId}/Users`),
    enabled: Boolean(playlistId),
  });
}

/** Share a playlist with a user (or update their edit permission). */
export function useSetPlaylistUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      userId,
      canEdit,
    }: {
      playlistId: string;
      userId: string;
      canEdit: boolean;
    }) =>
      jf.post(`/Playlists/${playlistId}/Users/${userId}`, { CanEdit: canEdit }),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["playlistUsers", v.playlistId] }),
  });
}

/** Stop sharing a playlist with a user. */
export function useRemovePlaylistUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      userId,
    }: {
      playlistId: string;
      userId: string;
    }) => jf.delete(`/Playlists/${playlistId}/Users/${userId}`),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["playlistUsers", v.playlistId] }),
  });
}

// ── Display preferences (server-side, follows the user across clients) ─

/** The user's display preferences for a given client namespace. */
export function useDisplayPreferences(id = "usersettings", client = "emby") {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["displayPreferences", userId, id, client],
    queryFn: () =>
      jf.get<DisplayPreferencesDto>(`/DisplayPreferences/${id}`, {
        userId,
        client,
      }),
    staleTime: 60 * 1000,
  });
}

/** Persist the user's display preferences server-side. */
export function useUpdateDisplayPreferences(
  id = "usersettings",
  client = "emby",
) {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  return useMutation({
    mutationFn: (prefs: DisplayPreferencesDto) =>
      jf.post(`/DisplayPreferences/${id}`, prefs, { userId, client }),
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "displayPreferences",
      }),
  });
}
