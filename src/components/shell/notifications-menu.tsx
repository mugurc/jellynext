"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Info,
  Loader2,
  MessageSquare,
  X,
  XCircle,
} from "lucide-react";
import type { ActivityLogEntry } from "@jellyfin/sdk/lib/generated-client";
import { useActivityLog } from "@/lib/jellyfin/admin-queries";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useNotifications } from "@/lib/notifications/store";
import { useTimeAgo } from "@/lib/hooks/use-time-ago";
import { cn } from "@/lib/utils";

/**
 * Header notification center. Merges this session's pushed messages (admin
 * "Send message") with the server Activity Log (admin), tracks unread state
 * client-side (Jellyfin's per-user Notifications API is gone on modern servers)
 * and refreshes live off the WebSocket's ActivityLogEntry pushes.
 */
export function NotificationsMenu() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const timeAgo = useTimeAgo();
  const { isAdmin } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activity = useActivityLog(30, isAdmin);
  const entries = isAdmin ? (activity.data?.Items ?? []) : [];

  const messages = useNotifications((s) => s.messages);
  const lastSeenActivityId = useNotifications((s) => s.lastSeenActivityId);
  const lastReadAt = useNotifications((s) => s.lastReadAt);
  const dismissMessage = useNotifications((s) => s.dismissMessage);
  const markAllRead = useNotifications((s) => s.markAllRead);

  const maxId = entries.reduce((m, e) => Math.max(m, e.Id ?? 0), 0);
  const unreadActivity = entries.filter(
    (e) => (e.Id ?? 0) > lastSeenActivityId,
  ).length;
  const unreadMessages = messages.filter((m) => m.at > lastReadAt).length;
  const unread = unreadActivity + unreadMessages;
  const isEmpty = !messages.length && !entries.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex size-[38px] items-center justify-center rounded-[9px] transition-colors",
          open
            ? "bg-white/[0.08] text-text"
            : "text-muted hover:bg-white/[0.06] hover:text-text",
        )}
        aria-label={t("title")}
        aria-expanded={open}
      >
        <Bell className="size-[19px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-jn-fade absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-border-strong bg-bg/97 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <span className="text-[13.5px] font-extrabold text-text">
              {t("title")}
            </span>
            <button
              type="button"
              onClick={() => markAllRead(maxId)}
              disabled={unread === 0}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-accent transition-colors hover:bg-white/[0.06] disabled:pointer-events-none disabled:text-dim"
            >
              <CheckCheck className="size-3.5" />
              {t("markAllRead")}
            </button>
          </div>

          <div className="max-h-[min(70vh,460px)] overflow-y-auto">
            {/* Session messages (admin "Send message") — newest first. */}
            {messages.map((m) => (
              <div
                key={`m-${m.id}`}
                className={cn(
                  "group flex items-start gap-3 border-b border-border/50 px-4 py-3",
                  m.at > lastReadAt && "bg-accent/[0.06]",
                )}
              >
                <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <MessageSquare className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-text">
                    {m.header}
                  </div>
                  {m.text && (
                    <p className="mt-0.5 text-[12px] leading-snug text-para">
                      {m.text}
                    </p>
                  )}
                  <div className="mt-1 text-[11px] text-dim">
                    {timeAgo(m.at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissMessage(m.id)}
                  aria-label={t("dismiss")}
                  className="flex size-6 flex-none items-center justify-center rounded-md text-dim opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-text"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}

            {/* Server activity log (admin). */}
            {entries.map((e) => (
              <ActivityNotification
                key={`a-${e.Id}`}
                entry={e}
                unread={(e.Id ?? 0) > lastSeenActivityId}
                timeAgo={timeAgo}
                onOpenItem={(id) => {
                  router.push(`/item/${id}`);
                  setOpen(false);
                }}
              />
            ))}

            {isAdmin && activity.isLoading && !entries.length && (
              <div className="flex items-center justify-center py-10 text-dim">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}

            {isEmpty && !activity.isLoading && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Bell className="size-6 text-dim" />
                <p className="text-[12.5px] text-muted">{t("empty")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityNotification({
  entry,
  unread,
  timeAgo,
  onOpenItem,
}: {
  entry: ActivityLogEntry;
  unread: boolean;
  timeAgo: (input?: string | number | null) => string;
  onOpenItem: (id: string) => void;
}) {
  const sev = String(entry.Severity);
  const Icon =
    sev === "Error" || sev === "Critical" || sev === "Fatal"
      ? XCircle
      : sev === "Warning"
        ? AlertTriangle
        : Info;
  const tone =
    sev === "Error" || sev === "Critical" || sev === "Fatal"
      ? "text-danger-soft"
      : sev === "Warning"
        ? "text-amber-400"
        : "text-dim";
  const clickable = !!entry.ItemId;

  const body = (
    <>
      <Icon className={cn("mt-0.5 size-4 flex-none", tone)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-text">
          {entry.Name}
        </div>
        {entry.ShortOverview && (
          <div className="truncate text-[12px] text-muted">
            {entry.ShortOverview}
          </div>
        )}
        <div className="mt-1 text-[11px] text-dim">{timeAgo(entry.Date)}</div>
      </div>
      {unread && (
        <span className="mt-1.5 size-2 flex-none rounded-full bg-accent" />
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onOpenItem(entry.ItemId as string)}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]",
          unread && "bg-accent/[0.06]",
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border/50 px-4 py-3",
        unread && "bg-accent/[0.06]",
      )}
    >
      {body}
    </div>
  );
}
