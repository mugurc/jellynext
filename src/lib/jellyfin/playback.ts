import type {
  MediaSourceInfo,
  PlaybackInfoResponse,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "./browser";
import { TICKS_PER_SECOND } from "./media";

/** A browser-oriented device profile: direct-play common MP4/WebM, HLS otherwise. */
export const DEVICE_PROFILE = {
  MaxStreamingBitrate: 120_000_000,
  MaxStaticBitrate: 100_000_000,
  MusicStreamingTranscodingBitrate: 384_000,
  DirectPlayProfiles: [
    {
      Container: "mp4,m4v,webm",
      Type: "Video",
      VideoCodec: "h264,vp8,vp9,av1",
      AudioCodec: "aac,mp3,opus,flac,vorbis",
    },
    { Container: "mp3", Type: "Audio" },
    { Container: "aac", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
  ],
  TranscodingProfiles: [
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac,mp3",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "2",
      MinSegments: 1,
      BreakOnNonKeyFrames: true,
    },
  ],
  ContainerProfiles: [],
  CodecProfiles: [],
  SubtitleProfiles: [
    { Format: "vtt", Method: "External" },
    { Format: "srt", Method: "External" },
    { Format: "ass", Method: "Encode" },
    { Format: "ssa", Method: "Encode" },
    { Format: "pgssub", Method: "Encode" },
  ],
} as const;

export interface PlaybackInfoParams {
  userId: string;
  startTimeTicks?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  maxStreamingBitrate?: number;
}

export async function getPlaybackInfo(
  itemId: string,
  params: PlaybackInfoParams,
): Promise<PlaybackInfoResponse> {
  return jf.post<PlaybackInfoResponse>(`/Items/${itemId}/PlaybackInfo`, {
    UserId: params.userId,
    DeviceProfile: DEVICE_PROFILE,
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

/** Proxy URL for a direct (static) video stream. */
export function directStreamUrl(
  itemId: string,
  source: MediaSourceInfo,
): string {
  const params = new URLSearchParams({
    static: "true",
    mediaSourceId: source.Id ?? itemId,
  });
  if (source.ETag) params.set("tag", source.ETag);
  const container = source.Container ? `.${source.Container}` : "";
  return `/api/jf/Videos/${itemId}/stream${container}?${params.toString()}`;
}

/** Proxy URL for an HLS transcode; strips api_key so the proxy injects auth. */
export function hlsUrl(transcodingUrl: string): string {
  const clean = transcodingUrl
    .replace(/[?&]api_key=[^&]*/i, (m) => (m[0] === "?" ? "?" : "&"))
    .replace(/\?&/, "?")
    .replace(/&$/, "");
  const path = clean.startsWith("/") ? clean : `/${clean}`;
  return `/api/jf${path}`;
}

/** Choose a playable URL for a resolved media source. */
export function resolvePlayback(
  itemId: string,
  source: MediaSourceInfo,
): { url: string; isHls: boolean } {
  if (
    (source.SupportsDirectPlay || source.SupportsDirectStream) &&
    !source.TranscodingUrl
  ) {
    return { url: directStreamUrl(itemId, source), isHls: false };
  }
  if (source.TranscodingUrl) {
    return { url: hlsUrl(source.TranscodingUrl), isHls: true };
  }
  return { url: directStreamUrl(itemId, source), isHls: false };
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

export function reportStart(body: ProgressBody): void {
  void jf.post("/Sessions/Playing", body).catch(() => {});
}
export function reportProgress(body: ProgressBody): void {
  void jf.post("/Sessions/Playing/Progress", body).catch(() => {});
}
export function reportStopped(body: ProgressBody): void {
  void jf.post("/Sessions/Playing/Stopped", body).catch(() => {});
}
