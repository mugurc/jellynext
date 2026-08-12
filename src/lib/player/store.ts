"use client";

import { create } from "zustand";

export interface Track {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
}

/** off → play through once · all → wrap around · one → repeat the track. */
export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Load a queue and start playing from `start`. */
  playQueue: (tracks: Track[], start?: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

const REPEAT_ORDER: RepeatMode[] = ["off", "all", "one"];

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: 0,
  isPlaying: false,
  shuffle: false,
  repeat: "off",
  playQueue: (tracks, start = 0) =>
    set({
      queue: tracks,
      index: Math.max(0, Math.min(start, tracks.length - 1)),
      isPlaying: true,
    }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  next: () => {
    const { index, queue, shuffle, repeat } = get();
    if (!queue.length) return;
    // "Repeat one" is handled by the player element (it re-seeks to 0); leaving
    // the index alone here is what tells it to do that.
    if (repeat === "one") {
      set({ isPlaying: true });
      return;
    }
    if (shuffle && queue.length > 1) {
      let pick = index;
      while (pick === index) pick = Math.floor(Math.random() * queue.length);
      set({ index: pick, isPlaying: true });
      return;
    }
    if (index < queue.length - 1) set({ index: index + 1, isPlaying: true });
    else if (repeat === "all") set({ index: 0, isPlaying: true });
    else set({ isPlaying: false });
  },
  prev: () =>
    set((s) => ({ index: Math.max(0, s.index - 1), isPlaying: true })),
  stop: () => set({ queue: [], index: 0, isPlaying: false }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat:
        REPEAT_ORDER[
          (REPEAT_ORDER.indexOf(s.repeat) + 1) % REPEAT_ORDER.length
        ],
    })),
}));
