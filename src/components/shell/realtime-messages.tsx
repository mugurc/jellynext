"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, X } from "lucide-react";
import type { SessionInfoDto } from "@jellyfin/sdk/lib/generated-client";
import { jf } from "@/lib/jellyfin/browser";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useNotifications } from "@/lib/notifications/store";
import {
  useRemoteControl,
  type RemoteAction,
} from "@/lib/player/remote-control";

const VOLUME_ACTIONS: Record<string, RemoteAction> = {
  SetVolume: "SetVolume",
  VolumeUp: "VolumeUp",
  VolumeDown: "VolumeDown",
  Mute: "Mute",
  Unmute: "Unmute",
  ToggleMute: "ToggleMute",
};

interface SocketInfo {
  serverUrl: string;
  token: string;
  deviceId: string;
}
interface Msg {
  id: number;
  header: string;
  text: string;
}

/**
 * Keeps a WebSocket open to Jellyfin so this client can RECEIVE messages
 * (admin "Send message", DisplayMessage commands) and show them as toasts.
 * Also registers capabilities so JellyNext advertises it can display messages
 * (otherwise the server won't route them here). Mounted once in the app shell.
 */
export function RealtimeMessages() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const router = useRouter();
  const dispatchRemote = useRemoteControl((s) => s.dispatch);
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let seq = 0;

    const push = (header: string, text: string) => {
      const id = ++seq;
      setMessages((m) => [...m, { id, header, text }]);
      setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 8000);
    };

    async function connect() {
      let info: SocketInfo;
      try {
        const res = await fetch("/api/socket-info");
        if (!res.ok) return;
        info = (await res.json()) as SocketInfo;
      } catch {
        return;
      }
      if (closed || !info.token || !info.serverUrl) return;

      // Advertise remote control + DisplayMessage. `SupportsMediaControl: true`
      // + an open WebSocket is what flips the session's `SupportsRemoteControl`
      // to true, which is what other clients' admin dashboards (incl. official
      // Jellyfin Web) gate the "Send message" action on.
      jf.post("/Sessions/Capabilities/Full", {
        PlayableMediaTypes: ["Video", "Audio"],
        // Playstate (pause/seek/next…) is gated on SupportsMediaControl;
        // GeneralCommands must be listed here to be delivered/offered.
        SupportedCommands: [
          "DisplayMessage",
          "SetVolume",
          "VolumeUp",
          "VolumeDown",
          "Mute",
          "Unmute",
          "ToggleMute",
        ],
        SupportsMediaControl: true,
        SupportsPersistentIdentifier: true,
      }).catch(() => {});

      const wsUrl = `${info.serverUrl.replace(/^http/, "ws")}/socket?api_key=${encodeURIComponent(
        info.token,
      )}&deviceId=${encodeURIComponent(info.deviceId)}`;

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }

      ws.onopen = () => {
        // Proactively keep the socket alive (Jellyfin drops idle sockets).
        keepAlive = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ MessageType: "KeepAlive" }));
        }, 30_000);
        // Admins get live session pushes (playback start/stop/pause) for the
        // dashboard, plus live Activity Log entries for the notification center.
        if (isAdmin) {
          ws?.send(
            JSON.stringify({ MessageType: "SessionsStart", Data: "0,1500" }),
          );
          ws?.send(
            JSON.stringify({
              MessageType: "ActivityLogEntryStart",
              Data: "0,1000",
            }),
          );
        }
      };

      ws.onmessage = (event) => {
        let data: {
          MessageType?: string;
          // Session pushes carry an array; parse it before the object view.
          Data?: {
            Command?: string;
            SeekPositionTicks?: number;
            PositionTicks?: number;
            Name?: string;
            Arguments?: {
              Header?: string;
              Text?: string;
              Volume?: string;
            };
            ItemIds?: string[];
            StartPositionTicks?: number;
            Type?: string;
            Data?: { Playlist?: { ItemId?: string }[] };
          };
        };
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }
        const t = data.MessageType;
        if (t === "ForceKeepAlive") {
          ws?.send(JSON.stringify({ MessageType: "KeepAlive" }));
          return;
        }

        // Live session list for the admin dashboard (pushed on every change).
        if (t === "Sessions") {
          const list = (data as { Data?: unknown }).Data;
          if (Array.isArray(list))
            queryClient.setQueryData(["sessions"], list as SessionInfoDto[]);
          return;
        }

        // Activity log changed — the push carries no payload, it's a signal to
        // refetch. Feeds the notification center's live updates.
        if (t === "ActivityLogEntry") {
          queryClient.invalidateQueries({ queryKey: ["activityLog"] });
          return;
        }

        // Playback transport commands (pause/seek/next…) → the active player.
        if (t === "Playstate" && data.Data?.Command) {
          dispatchRemote({
            action: data.Data.Command as RemoteAction,
            seekTicks: data.Data.SeekPositionTicks,
          });
          return;
        }

        // SyncPlay (watch party) — follow the group's scheduled commands.
        if (t === "SyncPlayCommand" && data.Data?.Command) {
          const c = data.Data.Command;
          const pos = data.Data.PositionTicks;
          if (c === "Unpause" || c === "Play")
            dispatchRemote({ action: "Unpause", seekTicks: pos });
          else if (c === "Pause")
            dispatchRemote({ action: "Pause", seekTicks: pos });
          else if (c === "Seek")
            dispatchRemote({ action: "Seek", seekTicks: pos });
          else if (c === "Stop") dispatchRemote({ action: "Stop" });
          return;
        }
        // The group's queue changed — open the current item to follow along.
        if (t === "SyncPlayGroupUpdate" && data.Data?.Type === "PlayQueue") {
          const first = data.Data.Data?.Playlist?.[0]?.ItemId;
          if (first && !window.location.pathname.endsWith(`/watch/${first}`)) {
            router.push(`/watch/${first}`);
          }
          return;
        }

        // Start playing an item on this device.
        if (t === "Play" && data.Data?.ItemIds?.length) {
          const start = data.Data.StartPositionTicks
            ? `?t=${Math.floor(data.Data.StartPositionTicks / 10_000_000)}`
            : "";
          router.push(`/watch/${data.Data.ItemIds[0]}${start}`);
          return;
        }

        if (t === "GeneralCommand" && data.Data?.Name) {
          const name = data.Data.Name;
          if (name === "DisplayMessage" && data.Data.Arguments) {
            const header = data.Data.Arguments.Header || "Jellyfin";
            const text = data.Data.Arguments.Text || "";
            push(header, text);
            // Also keep it in the notification center (not just the toast).
            useNotifications.getState().addMessage(header, text);
            return;
          }
          const volAction = VOLUME_ACTIONS[name];
          if (volAction) {
            const vol = data.Data.Arguments?.Volume;
            dispatchRemote({
              action: volAction,
              volume: vol != null ? Number(vol) : undefined,
            });
          }
        }
      };

      ws.onclose = () => {
        if (keepAlive) clearInterval(keepAlive);
        if (!closed) reconnect = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    }

    void connect();

    return () => {
      closed = true;
      if (keepAlive) clearInterval(keepAlive);
      if (reconnect) clearTimeout(reconnect);
      ws?.close();
    };
    // router + dispatchRemote are stable; the socket should open once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!messages.length) return null;

  return (
    <div className="pointer-events-none fixed top-20 right-6 z-[80] flex flex-col gap-2.5">
      {messages.map((m) => (
        <div
          key={m.id}
          className="animate-jn-pop pointer-events-auto flex w-[320px] items-start gap-3 rounded-xl border border-border-strong bg-bg/95 p-4 shadow-2xl backdrop-blur-md"
          role="status"
        >
          <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent">
            <MessageSquare className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-text">
              {m.header}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-para">
              {m.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setMessages((list) => list.filter((x) => x.id !== m.id))
            }
            aria-label="Dismiss"
            className="flex size-6 flex-none items-center justify-center rounded-md text-dim hover:bg-white/10 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
