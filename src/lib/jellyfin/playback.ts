import type {
  BaseItemDto,
  MediaSourceInfo,
  PlaybackInfoResponse,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "./browser";
import { getDeviceProfile } from "./device-profile";
import type { MediaCredentials } from "./direct";
import { TICKS_PER_SECOND, ticksToSeconds } from "./media";
import { pickAudioIndex, pickSubtitleIndex } from "./tracks";
import { bitrateForQuality, type MaxQuality } from "@/lib/prefs/store";

export interface PlaybackInfoParams {
  userId: string;
  startTimeTicks?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  maxStreamingBitrate?: number;
}

/** The prefs an initial playback selection depends on. */
export interface PlaybackPrefs {
  audioLang: string;
  subtitleLang: string;
  subtitlesDefault: boolean;
  maxQuality: MaxQuality;
  audioTrackChoice: { itemId: string; index: number } | null;
}

export interface InitialSelection {
  /** Absolute audio stream index, or undefined to let the server choose. */
  audioIndex?: number;
  /** Absolute subtitle stream index, or -1 for off. */
  subtitleIndex: number;
  /** Subtitle to burn into the transcode (image subs only), or -1 for none. */
  burnIndex: number;
  bitrate: number;
  startSeconds: number;
}

/**
 * How playback of `item` should start: which tracks, what quality cap and where
 * to resume. Shared by the player and by the detail page's prefetch so both
 * describe the same request — a mismatch would silently waste the prefetch.
 */
export function initialSelection(
  item: BaseItemDto,
  prefs: PlaybackPrefs,
): InitialSelection {
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const audios = streams.filter((s) => String(s.Type) === "Audio");
  const subs = streams.filter((s) => String(s.Type) === "Subtitle");

  // An explicit pre-play track choice for this item wins; otherwise fall back
  // to the remembered language preference.
  const choice =
    prefs.audioTrackChoice && prefs.audioTrackChoice.itemId === item.Id
      ? prefs.audioTrackChoice.index
      : undefined;
  const audioIndex =
    choice != null && audios.some((s) => s.Index === choice)
      ? choice
      : pickAudioIndex(audios, prefs.audioLang);

  // Remembered language first; failing that, "subtitles on by default" falls
  // back to the first renderable track so the preference actually does something.
  let subtitleIndex = pickSubtitleIndex(subs, prefs.subtitleLang);
  if (subtitleIndex < 0 && prefs.subtitlesDefault) {
    const fallback =
      subs.find((s) => s.IsTextSubtitleStream ?? true) ?? subs[0];
    if (fallback?.Index != null) subtitleIndex = fallback.Index;
  }

  // A remembered image subtitle must be burned into the initial transcode.
  const chosen =
    subtitleIndex >= 0
      ? subs.find((s) => (s.Index ?? -1) === subtitleIndex)
      : undefined;
  const burnIndex =
    subtitleIndex >= 0 && !(chosen?.IsTextSubtitleStream ?? true)
      ? subtitleIndex
      : -1;

  return {
    audioIndex,
    subtitleIndex,
    burnIndex,
    bitrate: bitrateForQuality(prefs.maxQuality),
    startSeconds: ticksToSeconds(item.UserData?.PlaybackPositionTicks),
  };
}

/** The PlaybackInfo request a selection corresponds to. */
export function selectionToParams(
  userId: string,
  selection: InitialSelection,
  startSeconds = selection.startSeconds,
): PlaybackInfoParams {
  return {
    userId,
    startTimeTicks: secondsToTicks(startSeconds),
    audioStreamIndex: selection.audioIndex,
    subtitleStreamIndex:
      selection.burnIndex >= 0 ? selection.burnIndex : undefined,
    maxStreamingBitrate: selection.bitrate,
  };
}

function requestPlaybackInfo(
  itemId: string,
  params: PlaybackInfoParams,
): Promise<PlaybackInfoResponse> {
  return jf.post<PlaybackInfoResponse>(`/Items/${itemId}/PlaybackInfo`, {
    UserId: params.userId,
    DeviceProfile: getDeviceProfile(),
    StartTimeTicks: params.startTimeTicks ?? 0,
    AudioStreamIndex: params.audioStreamIndex,
    SubtitleStreamIndex: params.subtitleStreamIndex,
    MaxStreamingBitrate: params.maxStreamingBitrate ?? 120_000_000,
    EnableDirectPlay: true,
    EnableDirectStream: true,
    EnableTranscoding: true,
    AllowVideoStreamCopy: true,
    AllowAudioStreamCopy: true,
    AutoOpenLiveStream: true,
  });
}

function infoKey(itemId: string, p: PlaybackInfoParams): string {
  return [
    itemId,
    p.userId,
    p.startTimeTicks ?? 0,
    p.audioStreamIndex ?? "",
    p.subtitleStreamIndex ?? "",
    p.maxStreamingBitrate ?? "",
  ].join("|");
}

/**
 * A single in-flight PlaybackInfo warmed ahead of a Play press.
 *
 * PlaybackInfo opens a play session server-side, so the response is consumed at
 * most once and expires quickly — this is a head start, not a cache.
 */
let warmed: {
  key: string;
  at: number;
  promise: Promise<PlaybackInfoResponse>;
} | null = null;
const WARM_TTL_MS = 15_000;

function warmIsUsable(key: string): boolean {
  return warmed?.key === key && Date.now() - warmed.at < WARM_TTL_MS;
}

/**
 * Start resolving playback before the user commits, so pressing Play doesn't
 * have to wait for a round trip that could have happened during the hover.
 * Safe to call repeatedly; only the first call per signature does work.
 */
export function prefetchPlaybackInfo(
  itemId: string,
  params: PlaybackInfoParams,
): void {
  const key = infoKey(itemId, params);
  if (warmIsUsable(key)) return;
  const promise = requestPlaybackInfo(itemId, params);
  // Keep a never-consumed prefetch from surfacing as an unhandled rejection;
  // the consumer still sees the original rejection.
  promise.catch(() => {});
  warmed = { key, at: Date.now(), promise };
}

export async function getPlaybackInfo(
  itemId: string,
  params: PlaybackInfoParams,
): Promise<PlaybackInfoResponse> {
  const key = infoKey(itemId, params);
  if (warmIsUsable(key)) {
    const promise = warmed!.promise;
    warmed = null; // one play session, one use
    return promise;
  }
  return requestPlaybackInfo(itemId, params);
}

/**
 * Build a media URL.
 *
 * With credentials the request goes straight to Jellyfin (authenticated by an
 * `api_key` query parameter, which is the only form a media element or an HLS
 * segment fetch can carry). Without them it falls back to the `/api/jf` proxy,
 * which authenticates from the session cookie instead.
 */
function mediaUrl(
  creds: MediaCredentials | null,
  path: string,
  params?: URLSearchParams,
): string {
  const qs = new URLSearchParams(params);
  if (creds) {
    qs.set("api_key", creds.token);
    return `${creds.serverUrl}${path}?${qs.toString()}`;
  }
  const query = qs.toString();
  return `/api/jf${path}${query ? `?${query}` : ""}`;
}

/** URL for a direct (static, original-file) video stream. */
export function directStreamUrl(
  itemId: string,
  source: MediaSourceInfo,
  creds: MediaCredentials | null = null,
): string {
  const params = new URLSearchParams({
    static: "true",
    mediaSourceId: source.Id ?? itemId,
  });
  if (source.ETag) params.set("tag", source.ETag);
  const container = source.Container ? `.${source.Container}` : "";
  return mediaUrl(creds, `/Videos/${itemId}/stream${container}`, params);
}

/**
 * URL for an HLS transcode. Jellyfin's own `TranscodingUrl` already carries an
 * api_key; it is dropped and re-applied by {@link mediaUrl} so the same URL
 * works in both direct and proxied mode.
 */
export function hlsUrl(
  transcodingUrl: string,
  creds: MediaCredentials | null = null,
): string {
  const [rawPath, rawQuery = ""] = transcodingUrl.split("?");
  const params = new URLSearchParams(rawQuery);
  params.delete("api_key");
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return mediaUrl(creds, path, params);
}

/** Choose a playable URL for a resolved media source. */
export function resolvePlayback(
  itemId: string,
  source: MediaSourceInfo,
  creds: MediaCredentials | null = null,
): { url: string; isHls: boolean } {
  // Direct play wins whenever the server offers it. Jellyfin routinely returns
  // a TranscodingUrl alongside a directly-playable source as a fallback, so
  // requiring its absence here meant a perfectly playable file got transcoded.
  if (source.SupportsDirectPlay) {
    return { url: directStreamUrl(itemId, source, creds), isHls: false };
  }
  if (source.TranscodingUrl) {
    return { url: hlsUrl(source.TranscodingUrl, creds), isHls: true };
  }
  return { url: directStreamUrl(itemId, source, creds), isHls: false };
}

/** URL for a directly-playable audio stream (original file). */
export function audioStreamUrl(
  itemId: string,
  creds: MediaCredentials | null = null,
): string {
  return mediaUrl(
    creds,
    `/Audio/${itemId}/stream`,
    new URLSearchParams({ static: "true" }),
  );
}

/**
 * URL for an on-the-fly WebVTT rendition of a text subtitle stream, suitable
 * for a `<track>` element (rendered client-side, no transcode).
 */
export function subtitleTrackUrl(
  itemId: string,
  mediaSourceId: string,
  streamIndex: number,
  creds: MediaCredentials | null = null,
): string {
  return mediaUrl(
    creds,
    `/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.vtt`,
  );
}

// ── Progress reporting ──────────────────────────────────────────────
interface ProgressBody {
  ItemId: string;
  MediaSourceId?: string;
  PlaySessionId?: string;
  PositionTicks: number;
  IsPaused?: boolean;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
}

export const secondsToTicks = (s: number) => Math.round(s * TICKS_PER_SECOND);

/**
 * Post a playback report in a way that survives the page going away.
 *
 * A normal fetch is cancelled when the document unloads, which is exactly when
 * the final position report matters most (closing the tab mid-film). These go
 * through the proxy rather than direct: it authenticates from the session
 * cookie, and sendBeacon can't set an Authorization header.
 */
function beacon(path: string, body: ProgressBody): void {
  const url = `/api/jf${path}`;
  const payload = JSON.stringify(body);
  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.(url, blob)) return;
  } catch {
    // Fall through to keepalive fetch.
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function reportStart(body: ProgressBody): void {
  void jf.post("/Sessions/Playing", body).catch(() => {});
}
export function reportProgress(body: ProgressBody, urgent = false): void {
  if (urgent) return beacon("/Sessions/Playing/Progress", body);
  void jf.post("/Sessions/Playing/Progress", body).catch(() => {});
}
/**
 * Always sent as a beacon: this is the report that sets the resume point, and
 * it fires while the player is being torn down.
 */
export function reportStopped(body: ProgressBody): void {
  beacon("/Sessions/Playing/Stopped", body);
}
