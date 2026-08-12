"use client";

/**
 * The device profile Jellyfin uses to decide direct play vs transcode.
 *
 * A hardcoded profile has to be pessimistic to stay correct, and every codec it
 * leaves out is a file the server re-encodes that this browser could have
 * played untouched — the single biggest cause of slow, CPU-hungry playback. So
 * the profile is derived instead: every entry below is admitted only because
 * `canPlayType` said "probably" for that exact container + codec combination.
 *
 * Only "probably" counts. "maybe" means the browser isn't sure, and betting on
 * it would trade a working transcode for a possible black screen — the same
 * behaviour as today is the better failure mode.
 */

interface Probe {
  /** Codec name as Jellyfin knows it. */
  name: string;
  /** RFC 6381 codec string for `canPlayType`. */
  codec: string;
}

const VIDEO_PROBES: Probe[] = [
  { name: "h264", codec: "avc1.42E01E" },
  { name: "hevc", codec: "hvc1.1.6.L93.B0" },
  { name: "vp8", codec: "vp8" },
  { name: "vp9", codec: "vp09.00.10.08" },
  { name: "av1", codec: "av01.0.05M.08" },
];

const AUDIO_PROBES: Probe[] = [
  { name: "aac", codec: "mp4a.40.2" },
  { name: "mp3", codec: "mp4a.40.34" },
  { name: "ac3", codec: "ac-3" },
  { name: "eac3", codec: "ec-3" },
  { name: "opus", codec: "opus" },
  { name: "flac", codec: "flac" },
  { name: "vorbis", codec: "vorbis" },
];

/** Standalone audio files, tested as whole MIME types. */
const AUDIO_FILE_PROBES: { container: string; mime: string }[] = [
  { container: "mp3", mime: "audio/mpeg" },
  { container: "aac", mime: "audio/aac" },
  { container: "m4a", mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { container: "flac", mime: "audio/flac" },
  { container: "ogg", mime: 'audio/ogg; codecs="vorbis"' },
  { container: "opus", mime: 'audio/ogg; codecs="opus"' },
  { container: "wav", mime: "audio/wav" },
  { container: "webma", mime: 'audio/webm; codecs="opus"' },
];

/** Video containers worth testing for direct file playback. */
const VIDEO_CONTAINERS: { container: string; mime: string }[] = [
  { container: "mp4,m4v", mime: "video/mp4" },
  { container: "webm", mime: "video/webm" },
  // Chromium and Firefox report no Matroska support, so this normally yields
  // nothing — but asking is free and Safari/other engines may differ.
  { container: "mkv", mime: "video/x-matroska" },
  { container: "mov", mime: "video/quicktime" },
];

interface ContainerSupport {
  container: string;
  video: string[];
  audio: string[];
}

/**
 * What JellyNext claimed without asking, kept as a floor.
 *
 * Detection must only ever WIDEN the profile. A browser can decline to answer
 * "probably" for a combination it does in fact play (mp3-in-mp4 is a common
 * one), and letting that narrow the profile would turn a previously
 * direct-played file into a transcode — a regression dressed up as a fix.
 */
const BASELINE: Record<string, { video: string[]; audio: string[] }> = {
  "mp4,m4v": { video: ["h264"], audio: ["aac", "mp3"] },
  webm: { video: ["vp8", "vp9"], audio: ["opus", "vorbis"] },
};

/** Audio containers previously claimed unconditionally. */
const BASELINE_AUDIO = ["mp3", "aac", "flac"];

const union = (...lists: string[][]): string[] => [...new Set(lists.flat())];

function probeElement(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  return document.createElement("video");
}

function supports(el: HTMLVideoElement, mime: string): boolean {
  try {
    return el.canPlayType(mime) === "probably";
  } catch {
    return false;
  }
}

/**
 * Codecs the browser confirms it can decode inside each container, unioned with
 * the baseline so the result is never narrower than what we shipped before.
 */
function detectContainers(el: HTMLVideoElement | null): ContainerSupport[] {
  const found: ContainerSupport[] = [];
  for (const { container, mime } of VIDEO_CONTAINERS) {
    const base = BASELINE[container];
    const video = el
      ? VIDEO_PROBES.filter((p) =>
          supports(el, `${mime}; codecs="${p.codec}"`),
        ).map((p) => p.name)
      : [];
    const audio = el
      ? AUDIO_PROBES.filter((p) =>
          supports(el, `${mime}; codecs="${p.codec}"`),
        ).map((p) => p.name)
      : [];
    // Containers with a baseline are always offered; the rest (mkv, mov) only
    // when the browser actually claimed a video codec for them.
    if (!base && !video.length) continue;
    found.push({
      container,
      video: union(base?.video ?? [], video),
      audio: union(base?.audio ?? [], audio),
    });
  }
  return found;
}

export interface DeviceProfile {
  MaxStreamingBitrate: number;
  MaxStaticBitrate: number;
  MusicStreamingTranscodingBitrate: number;
  DirectPlayProfiles: Record<string, unknown>[];
  TranscodingProfiles: Record<string, unknown>[];
  ContainerProfiles: unknown[];
  CodecProfiles: unknown[];
  SubtitleProfiles: { Format: string; Method: string }[];
}

function buildProfile(): DeviceProfile {
  const el = probeElement();

  const directPlay: Record<string, unknown>[] = detectContainers(el).map(
    (c) => ({
      Container: c.container,
      Type: "Video",
      VideoCodec: c.video.join(","),
      // Jellyfin reads an absent AudioCodec as "any", which is the right
      // meaning when we couldn't name a single codec for the container.
      ...(c.audio.length ? { AudioCodec: c.audio.join(",") } : {}),
    }),
  );

  const audioContainers = union(
    BASELINE_AUDIO,
    el
      ? AUDIO_FILE_PROBES.filter((p) => supports(el, p.mime)).map(
          (p) => p.container,
        )
      : [],
  );
  for (const container of audioContainers) {
    directPlay.push({ Container: container, Type: "Audio" });
  }

  // Audio the browser can decode natively can be stream-copied into the HLS
  // transcode instead of re-encoded — the video is already copied when its
  // codec matches (AllowVideoStreamCopy). AC3/E-AC3 is the common win here:
  // most movie files carry it, and without this every one of them pays a full
  // audio re-encode.
  const hlsAudio = el
    ? AUDIO_PROBES.filter((p) =>
        supports(el, `video/mp4; codecs="${p.codec}"`),
      ).map((p) => p.name)
    : [];
  // aac/mp3 stay listed unconditionally: they are the universal HLS targets and
  // must remain available as the re-encode destination.
  const transcodeAudio = union(["aac", "mp3"], hlsAudio).join(",");

  return {
    MaxStreamingBitrate: 120_000_000,
    MaxStaticBitrate: 100_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: [
      {
        Container: "ts",
        Type: "Video",
        VideoCodec: "h264",
        AudioCodec: transcodeAudio,
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
  };
}

let cached: DeviceProfile | null = null;

/** The detected profile, probed once per page load. */
export function getDeviceProfile(): DeviceProfile {
  cached ??= buildProfile();
  return cached;
}

/** Human-readable summary of what direct play was negotiated as (diagnostics). */
export function describeDirectPlay(): string {
  return getDeviceProfile()
    .DirectPlayProfiles.filter((p) => p.Type === "Video")
    .map((p) => `${p.Container}: ${p.VideoCodec ?? "any"}`)
    .join(" · ");
}
