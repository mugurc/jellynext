"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A message pushed to this client during the session (admin "Send message"). */
export interface SessionMessage {
  id: number;
  header: string;
  text: string;
  at: number; // epoch ms
}

interface NotifState {
  /** DisplayMessages received this session (in-memory, newest first). */
  messages: SessionMessage[];
  /** Highest activity-log entry id the user has seen (read watermark). */
  lastSeenActivityId: number;
  /** Timestamp up to which session messages count as read. */
  lastReadAt: number;
  addMessage: (header: string, text: string) => void;
  dismissMessage: (id: number) => void;
  /** Mark everything up to `maxActivityId` and now as read. */
  markAllRead: (maxActivityId: number) => void;
}

let seq = 0;

/**
 * Client-side notification state. Jellyfin's per-user Notifications API is gone
 * on modern servers (404), so unread state is tracked here against the admin
 * Activity Log's monotonic ids plus this session's pushed messages.
 */
export const useNotifications = create<NotifState>()(
  persist(
    (set) => ({
      messages: [],
      lastSeenActivityId: 0,
      lastReadAt: 0,
      addMessage: (header, text) =>
        set((s) => ({
          messages: [
            { id: ++seq, header, text, at: Date.now() },
            ...s.messages,
          ].slice(0, 50),
        })),
      dismissMessage: (id) =>
        set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
      markAllRead: (maxActivityId) =>
        set((s) => ({
          lastSeenActivityId: Math.max(s.lastSeenActivityId, maxActivityId),
          lastReadAt: Date.now(),
        })),
    }),
    {
      name: "jn_notifications",
      // Session messages are ephemeral; only persist the read watermarks.
      partialize: (s) => ({
        lastSeenActivityId: s.lastSeenActivityId,
        lastReadAt: s.lastReadAt,
      }),
    },
  ),
);
