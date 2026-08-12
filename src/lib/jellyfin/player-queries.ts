"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "./browser";
import { useCurrentUser } from "@/lib/auth/current-user";

// ── Media Segments (Skip Intro / Skip Credits) ───────────────────────

export type MediaSegmentType =
  "Unknown" | "Commercial" | "Preview" | "Recap" | "Outro" | "Intro";

export interface MediaSegment {
  Id: string;
  ItemId: string;
  Type: MediaSegmentType;
  StartTicks: number;
  EndTicks: number;
}

interface MediaSegmentResult {
  Items: MediaSegment[];
  TotalRecordCount: number;
}

/**
 * Intro/outro/recap/commercial segments for an item (Jellyfin 10.9+). Empty
 * unless a segment provider (e.g. Intro Skipper) has analysed the item.
 */
export function useMediaSegments(itemId: string | undefined) {
  return useQuery({
    queryKey: ["mediaSegments", itemId],
    queryFn: () =>
      jf.get<MediaSegmentResult>(`/MediaSegments/${itemId}`, {
        includeSegmentTypes: "Intro,Outro,Recap,Preview,Commercial",
      }),
    enabled: Boolean(itemId),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Adjacent episode (Next / Previous, for autoplay) ─────────────────

/**
 * The previous and next episodes around `episodeId` within its series (either
 * may be null at a boundary). Uses Jellyfin's `AdjacentTo`, which returns the
 * previous, current and next episodes. A series can carry DUPLICATE entries for
 * the same episode (two files) that appear adjacent, so neighbours sharing the
 * current episode's season+number are treated as "no neighbour".
 */
export function useAdjacentEpisodes(
  seriesId: string | undefined,
  episodeId: string | undefined,
) {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["adjacentEpisodes", userId, seriesId, episodeId],
    queryFn: async () => {
      const res = await jf.get<BaseItemDtoQueryResult>(
        `/Shows/${seriesId}/Episodes`,
        {
          userId,
          adjacentTo: episodeId,
          fields: "Overview,MediaSourceCount,PrimaryImageAspectRatio",
          imageTypeLimit: 1,
          enableImageTypes: "Primary,Thumb",
        },
      );
      const items = res.Items ?? [];
      const idx = items.findIndex((e) => e.Id === episodeId);
      const cur = idx >= 0 ? items[idx] : undefined;
      const sameEp = (a?: BaseItemDto) =>
        a &&
        cur &&
        a.ParentIndexNumber === cur.ParentIndexNumber &&
        a.IndexNumber === cur.IndexNumber;
      const prev = idx > 0 && !sameEp(items[idx - 1]) ? items[idx - 1] : null;
      const next =
        idx >= 0 && idx + 1 < items.length && !sameEp(items[idx + 1])
          ? items[idx + 1]
          : null;
      return { previous: prev, next };
    },
    enabled: Boolean(seriesId && episodeId),
    staleTime: 60 * 1000,
  });
}

// ── Subtitle search / download / upload ──────────────────────────────

export interface RemoteSubtitleInfo {
  Id: string;
  ProviderName?: string;
  Name?: string;
  Format?: string;
  Author?: string;
  Comment?: string;
  ThreeLetterISOLanguageName?: string;
  DownloadCount?: number;
  CommunityRating?: number;
  IsHashMatch?: boolean;
}

/** Search configured providers (e.g. Open Subtitles) for downloadable subs. */
export function useRemoteSubtitleSearch(
  itemId: string | undefined,
  language: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["remoteSubtitles", itemId, language],
    queryFn: () =>
      jf.get<RemoteSubtitleInfo[]>(
        `/Items/${itemId}/RemoteSearch/Subtitles/${language}`,
      ),
    enabled: Boolean(itemId && language) && enabled,
    staleTime: 60 * 1000,
  });
}

/** Download a provider subtitle onto the server (adds an external stream). */
export function useDownloadRemoteSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      subtitleId,
    }: {
      itemId: string;
      subtitleId: string;
    }) => jf.post(`/Items/${itemId}/RemoteSearch/Subtitles/${subtitleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item"] }),
  });
}

/** Upload a subtitle file to an item (base64 body → `UploadSubtitleDto`). */
export function useUploadSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      language,
      format,
      isForced,
      isHearingImpaired,
      data,
    }: {
      itemId: string;
      language: string;
      format: string;
      isForced?: boolean;
      isHearingImpaired?: boolean;
      /** Base64-encoded subtitle file contents (no data: prefix). */
      data: string;
    }) =>
      jf.post(`/Videos/${itemId}/Subtitles`, {
        Language: language,
        Format: format,
        IsForced: Boolean(isForced),
        IsHearingImpaired: Boolean(isHearingImpaired),
        Data: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item"] }),
  });
}

/** Delete an external subtitle stream from a media source. */
export function useDeleteSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, index }: { itemId: string; index: number }) =>
      jf.delete(`/Videos/${itemId}/Subtitles/${index}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item"] }),
  });
}
