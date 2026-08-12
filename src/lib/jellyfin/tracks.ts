import type {
  MediaSourceInfo,
  MediaStream,
} from "@jellyfin/sdk/lib/generated-client";

export type StreamKind = "Audio" | "Subtitle" | "Video";

/** MediaStreams of a source filtered by type. */
export function streamsByType(
  source: MediaSourceInfo | undefined,
  kind: StreamKind,
): MediaStream[] {
  return (source?.MediaStreams ?? []).filter((s) => String(s.Type) === kind);
}

/** Human-readable language name for a stream ("English" from "English - SRT"). */
export function streamLanguageName(s: MediaStream): string {
  const label = (s.DisplayTitle ?? s.Language ?? "").split(" - ")[0].trim();
  return label || (s.Language ?? "");
}

/** A generic option for the track dropdown: `value` identifies the choice. */
export interface PickerOption {
  value: string;
  label: string;
}

/** Distinct languages present in a set of streams (first stream wins the label). */
export function uniqueLanguages(streams: MediaStream[]): PickerOption[] {
  const map = new Map<string, string>();
  for (const s of streams) {
    const lang = s.Language ?? "";
    if (!lang || map.has(lang)) continue;
    map.set(lang, streamLanguageName(s));
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}

/** Rich label for a single audio stream (server DisplayTitle, else composed). */
export function audioTrackLabel(s: MediaStream): string {
  if (s.DisplayTitle) return s.DisplayTitle;
  const parts = [
    streamLanguageName(s),
    s.Codec?.toUpperCase(),
    s.Channels ? `${s.Channels} ch` : null,
  ].filter(Boolean);
  return parts.join(" · ") || `Audio ${s.Index ?? "?"}`;
}

/** Every audio stream as a pickable option (value = absolute stream index). */
export function audioTrackOptions(streams: MediaStream[]): PickerOption[] {
  return streams
    .filter((s) => s.Index != null)
    .map((s) => ({ value: String(s.Index), label: audioTrackLabel(s) }));
}

/** Absolute index of the preferred audio stream (language match → default → first). */
export function pickAudioIndex(
  streams: MediaStream[],
  lang: string,
): number | undefined {
  if (!streams.length) return undefined;
  if (lang) {
    const match = streams.find((s) => s.Language === lang);
    if (match?.Index != null) return match.Index;
  }
  const fallback = streams.find((s) => s.IsDefault) ?? streams[0];
  return fallback?.Index ?? undefined;
}

/** Absolute index of the preferred subtitle stream, or -1 for off. */
export function pickSubtitleIndex(
  streams: MediaStream[],
  lang: string,
): number {
  if (!lang) return -1;
  const match = streams.find((s) => s.Language === lang);
  return match?.Index ?? -1;
}

/** Language code of the stream at a given absolute index. */
export function languageAtIndex(
  streams: MediaStream[],
  index: number | undefined,
): string {
  if (index == null || index < 0) return "";
  return streams.find((s) => s.Index === index)?.Language ?? "";
}
