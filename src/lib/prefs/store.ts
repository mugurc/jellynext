"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SubtitleSize = "small" | "medium" | "large";
export type MaxQuality = "auto" | "1080p" | "720p" | "480p";

export interface PrefsState {
  autoplayNext: boolean;
  reduceMotion: boolean;
  maxQuality: MaxQuality;
  autoplayTrailers: boolean;
  skipIntros: boolean;
  subtitlesDefault: boolean;
  subtitleSize: SubtitleSize;
  audioNormalize: boolean;
  /** Preferred audio language code ("" = source default). Remembered across items. */
  audioLang: string;
  /** Preferred subtitle language code ("" = off). Remembered across items. */
  subtitleLang: string;
  /** Explicit audio stream chosen for a specific item; overrides the language pick when it matches. */
  audioTrackChoice: { itemId: string; index: number } | null;
  set: <K extends keyof PrefsState>(key: K, value: PrefsState[K]) => void;
}

export const PREFS_DEFAULTS: Omit<PrefsState, "set"> = {
  autoplayNext: true,
  reduceMotion: false,
  maxQuality: "auto",
  autoplayTrailers: true,
  skipIntros: false,
  subtitlesDefault: false,
  subtitleSize: "medium",
  audioNormalize: false,
  audioLang: "",
  subtitleLang: "",
  audioTrackChoice: null,
};

/** Client-side viewing preferences, persisted to localStorage. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...PREFS_DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<PrefsState>),
    }),
    { name: "jn_prefs" },
  ),
);
