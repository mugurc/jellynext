"use client";

import { create } from "zustand";

interface PlayQueueState {
  /** Ordered item ids to play through. */
  ids: string[];
  /** Human label for the source (series / collection / playlist name). */
  title: string;
  /** Replace the queue. */
  setQueue: (ids: string[], title?: string) => void;
  /**
   * Append items, or splice them in right after whatever is playing.
   *
   * Jellyfin's remote Play command carries a PlayCommand of PlayNow, PlayNext
   * or PlayLast; the last two are a request to QUEUE, not to navigate.
   */
  enqueue: (ids: string[], next?: boolean, afterId?: string | null) => void;
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
  enqueue: (ids, next = false, afterId = null) =>
    set((s) => {
      // Never queue something twice.
      const fresh = ids.filter((id) => !s.ids.includes(id));
      if (!fresh.length) return s;
      const at = afterId ? s.ids.indexOf(afterId) : -1;
      if (!next || at < 0) return { ...s, ids: [...s.ids, ...fresh] };
      return {
        ...s,
        ids: [...s.ids.slice(0, at + 1), ...fresh, ...s.ids.slice(at + 1)],
      };
    }),
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
