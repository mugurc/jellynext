"use client";

import { create } from "zustand";

export type RemoteAction =
  | "Pause"
  | "Unpause"
  | "PlayPause"
  | "Stop"
  | "Seek"
  | "NextTrack"
  | "PreviousTrack"
  | "SetVolume"
  | "VolumeUp"
  | "VolumeDown"
  | "Mute"
  | "Unmute"
  | "ToggleMute";

export interface RemoteCommand {
  /** Bumped on every dispatch so identical actions still re-trigger. */
  seq: number;
  action: RemoteAction;
  seekTicks?: number;
  /** Target volume 0–100 (for SetVolume). */
  volume?: number;
}

interface RemoteControlState {
  command: RemoteCommand | null;
  dispatch: (cmd: Omit<RemoteCommand, "seq">) => void;
}

/**
 * Playback commands received over the Jellyfin WebSocket (another client's
 * remote control) that the active player should apply. In-memory bus: the
 * player subscribes to `command` and executes it.
 */
export const useRemoteControl = create<RemoteControlState>((set) => ({
  command: null,
  dispatch: (cmd) =>
    set((s) => ({
      command: { ...cmd, seq: (s.command?.seq ?? 0) + 1 },
    })),
}));
