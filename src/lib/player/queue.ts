"use client";

import { create } from "zustand";

interface PlayQueueState {
  /** Ordered item ids to play through. */
  ids: string[];
  /** Human label for the source (series / collection / playlist name). */
  title: string;
  /** Replace the queue. */
  setQueue: (ids: string[], title?: string) => void;
  /** Empty the queue (single-item playback). */
  clear: () => void;
}

/**
 * The active video play queue, set when playback starts from a container
 * (a series' episodes, a collection or a playlist). The player reads it to
 * drive prev / next / autoplay across items, falling back to episode
 * adjacency when the current item isn't part of a queue. In-memory only —
 * a queue is scoped to the current browsing session.
 */
export const usePlayQueue = create<PlayQueueState>((set) => ({
  ids: [],
  title: "",
  setQueue: (ids, title = "") => set({ ids, title }),
  clear: () => set({ ids: [], title: "" }),
}));

/** Neighbours of `id` within a queue (nulls at the ends / when absent). */
export function queueNeighbours(
  ids: string[],
  id: string,
): { index: number; prev: string | null; next: string | null } {
  const index = ids.indexOf(id);
  if (index < 0) return { index: -1, prev: null, next: null };
  return {
    index,
    prev: index > 0 ? ids[index - 1] : null,
    next: index + 1 < ids.length ? ids[index + 1] : null,
  };
}
