"use client";

import { create } from "zustand";

export interface Track {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
}

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  /** Load a queue and start playing from `start`. */
  playQueue: (tracks: Track[], start?: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: 0,
  isPlaying: false,
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
    const { index, queue } = get();
    if (index < queue.length - 1) set({ index: index + 1, isPlaying: true });
    else set({ isPlaying: false });
  },
  prev: () =>
    set((s) => ({ index: Math.max(0, s.index - 1), isPlaying: true })),
  stop: () => set({ queue: [], index: 0, isPlaying: false }),
}));
