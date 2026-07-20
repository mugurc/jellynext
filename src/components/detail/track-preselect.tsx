"use client";

import { useTranslations } from "next-intl";
import { Captions, Volume2 } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { usePrefs } from "@/lib/prefs/store";
import {
  audioTrackOptions,
  streamsByType,
  uniqueLanguages,
} from "@/lib/jellyfin/tracks";
import { TrackPicker } from "@/components/media/track-picker";

/**
 * Pre-play playback options panel: pick a specific audio track (by stream, so
 * same-language tracks are distinguishable) and a subtitle language before
 * hitting Play. The audio choice is remembered per item and the player starts
 * on it; the languages persist across items as defaults.
 */
export function TrackPreselect({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Player");
  const subtitleLang = usePrefs((s) => s.subtitleLang);
  const audioTrackChoice = usePrefs((s) => s.audioTrackChoice);
  const set = usePrefs((s) => s.set);

  const source = item.MediaSources?.[0];
  const audioStreams = streamsByType(source, "Audio");
  const subStreams = streamsByType(source, "Subtitle");
  const audioOptions = audioTrackOptions(audioStreams);
  const subs = uniqueLanguages(subStreams);

  const hasAudio = audioOptions.length > 1;
  const hasSubs = subs.length > 0;
  if (!hasAudio && !hasSubs) return null;

  // The audio value is this item's explicit choice, if one is still valid.
  const chosenIndex =
    audioTrackChoice && audioTrackChoice.itemId === item.Id
      ? audioTrackChoice.index
      : undefined;
  const audioValue =
    chosenIndex != null && audioStreams.some((s) => s.Index === chosenIndex)
      ? String(chosenIndex)
      : "";

  function chooseAudio(value: string) {
    if (!item.Id) return;
    if (value === "") {
      set("audioTrackChoice", null);
      return;
    }
    const index = Number(value);
    set("audioTrackChoice", { itemId: item.Id, index });
    // Keep the cross-item language default aligned with the picked track.
    const lang = audioStreams.find((s) => s.Index === index)?.Language ?? "";
    set("audioLang", lang);
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-scrim/25 p-4 backdrop-blur-md lg:w-[300px] lg:flex-none">
      <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
        {t("playbackOptions")}
      </span>
      {hasAudio && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted">
            {t("audio")}
          </span>
          <TrackPicker
            block
            icon={<Volume2 className="size-4" />}
            value={audioValue}
            options={audioOptions}
            emptyLabel={t("auto")}
            onChange={chooseAudio}
            searchPlaceholder={t("searchLanguage")}
            noMatchesLabel={t("noMatches")}
          />
        </div>
      )}
      {hasSubs && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted">
            {t("subtitles")}
          </span>
          <TrackPicker
            block
            icon={<Captions className="size-4" />}
            value={subtitleLang}
            options={subs}
            emptyLabel={t("off")}
            onChange={(l) => set("subtitleLang", l)}
            searchPlaceholder={t("searchLanguage")}
            noMatchesLabel={t("noMatches")}
          />
        </div>
      )}
    </div>
  );
}
