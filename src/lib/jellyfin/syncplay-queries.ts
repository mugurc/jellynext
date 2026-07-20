"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jf } from "./browser";

export interface SyncPlayGroup {
  GroupId: string;
  GroupName: string;
  /** "Idle" | "Waiting" | "Paused" | "Playing" */
  State: string;
  Participants: string[];
  LastUpdatedAt: string;
}

/** All open SyncPlay groups on the server (polled while the panel is open). */
export function useSyncPlayGroups(enabled: boolean) {
  return useQuery({
    queryKey: ["syncplayGroups"],
    queryFn: () => jf.get<SyncPlayGroup[]>("/SyncPlay/List"),
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}

/** Create a new group (the caller joins it automatically). */
export function useSyncPlayNew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupName: string) =>
      jf.post<SyncPlayGroup>("/SyncPlay/New", { GroupName: groupName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["syncplayGroups"] }),
  });
}

export function useSyncPlayJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      jf.post("/SyncPlay/Join", { GroupId: groupId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["syncplayGroups"] }),
  });
}

export function useSyncPlayLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jf.post("/SyncPlay/Leave"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["syncplayGroups"] }),
  });
}

// ── Group playback commands (this client drives the party) ───────────

/** Point the group at an item so every member loads the same content. */
export function syncPlaySetQueue(itemId: string, startTicks: number): void {
  void jf
    .post("/SyncPlay/SetNewQueue", {
      PlayingQueue: [itemId],
      PlayingItemPosition: 0,
      StartPositionTicks: Math.round(startTicks),
    })
    .catch(() => {});
}

export function syncPlayUnpause(): void {
  void jf.post("/SyncPlay/Unpause").catch(() => {});
}

export function syncPlayPause(): void {
  void jf.post("/SyncPlay/Pause").catch(() => {});
}

export function syncPlaySeek(positionTicks: number): void {
  void jf
    .post("/SyncPlay/Seek", { PositionTicks: Math.round(positionTicks) })
    .catch(() => {});
}
