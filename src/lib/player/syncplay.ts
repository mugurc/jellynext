"use client";

import { create } from "zustand";

interface SyncPlayState {
  /** The group this device has joined, or null. */
  groupId: string | null;
  groupName: string;
  join: (groupId: string, groupName: string) => void;
  leave: () => void;
}

/**
 * The active SyncPlay (watch-party) group for this browsing session. Group
 * membership + commands go through the REST proxy; the group's live state is
 * polled from `/SyncPlay/List`. Precise position following requires a
 * persistent WebSocket to the server (which pushes scheduled commands) — that
 * conflicts with keeping the access token in an httpOnly cookie, so JellyNext
 * can host/drive a party (other clients follow its commands) and coarsely
 * follow play/pause, but doesn't frame-sync to others' seeks.
 */
export const useSyncPlay = create<SyncPlayState>((set) => ({
  groupId: null,
  groupName: "",
  join: (groupId, groupName) => set({ groupId, groupName }),
  leave: () => set({ groupId: null, groupName: "" }),
}));
