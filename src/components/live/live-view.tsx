"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play, Radio, Tv } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { GridSkeleton } from "@/components/media/skeletons";
import { useLiveChannels, useLiveRecordings } from "@/lib/jellyfin/queries";
import { gradientFallback, posterUrl, thumbUrl } from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

type Tab = "channels" | "guide" | "recordings";
const TABS: Tab[] = ["channels", "guide", "recordings"];

function channelCode(name?: string | null): string {
  if (!name) return "TV";
  const letters = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
  const words = letters.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return letters.slice(0, 3).toUpperCase() || "TV";
}

function timeLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Current epoch ms, refreshed on an interval (read outside render for purity). */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

function ChannelLogo({
  channel,
  size = 46,
}: {
  channel: BaseItemDto;
  size?: number;
}) {
  const img = posterUrl(channel, { maxWidth: 120 });
  return (
    <span
      className="flex flex-none items-center justify-center rounded-lg bg-cover bg-center text-[13px] font-extrabold text-white"
      style={{
        width: size,
        height: size,
        backgroundImage: img
          ? `url("${img}"), ${gradientFallback(channel.Id)}`
          : gradientFallback(channel.Id),
      }}
    >
      {!img && channelCode(channel.Name)}
    </span>
  );
}

export function LiveView() {
  const t = useTranslations("Live");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("channels");
  const now = useNow();

  const channelsQuery = useLiveChannels();
  const recordingsQuery = useLiveRecordings();

  const channels = channelsQuery.data?.Items ?? [];
  const recordings = recordingsQuery.data?.Items ?? [];

  const loading =
    tab === "recordings" ? recordingsQuery.isLoading : channelsQuery.isLoading;

  const noChannels =
    !channelsQuery.isLoading && channels.length === 0 && tab !== "recordings";

  function watch(id?: string | null) {
    if (id) router.push(`/watch/${id}`);
  }

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-16">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <div className="ml-1 flex gap-1 rounded-[10px] bg-white/[0.04] p-1">
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                tab === x
                  ? "bg-accent text-on-accent"
                  : "text-muted hover:text-bright",
              )}
            >
              {t(x)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <GridSkeleton count={8} />
      ) : tab === "recordings" ? (
        recordings.length ? (
          <div className="flex flex-col gap-2.5">
            {recordings.map((r) => (
              <RecordingRow key={r.Id} rec={r} onPlay={() => watch(r.Id)} />
            ))}
          </div>
        ) : (
          <Empty icon="radio" text={t("noRecordings")} />
        )
      ) : noChannels ? (
        <Empty icon="tv" text={t("notSetup")} />
      ) : tab === "guide" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {channels.map((ch) => (
            <GuideRow
              key={ch.Id}
              channel={ch}
              now={now}
              onPlay={() => watch(ch.Id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {channels.map((ch) => (
            <button
              key={ch.Id}
              type="button"
              onClick={() => watch(ch.Id)}
              className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-colors hover:border-accent/60"
            >
              <ChannelLogo channel={ch} size={52} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{ch.Name}</div>
                <div className="text-[11.5px] font-semibold text-accent">
                  {t("onNow")}
                </div>
                <div className="truncate text-[12px] text-muted">
                  {ch.CurrentProgram?.Name ?? "—"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideRow({
  channel,
  now,
  onPlay,
}: {
  channel: BaseItemDto;
  now: number;
  onPlay: () => void;
}) {
  const prog = channel.CurrentProgram;
  const start = prog?.StartDate ? Date.parse(prog.StartDate) : 0;
  const end = prog?.EndDate ? Date.parse(prog.EndDate) : 0;
  const pct =
    start && end && end > start
      ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
      : 0;

  return (
    <div className="flex items-stretch gap-3 border-b border-border/60 px-3 py-3 last:border-0">
      <div className="flex w-[190px] flex-none items-center gap-3">
        <ChannelLogo channel={channel} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold">{channel.Name}</div>
          {channel.Number && (
            <div className="text-[11px] text-dim">{channel.Number}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-white/[0.03] px-3.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">
            {prog?.Name ?? "—"}
          </div>
          {prog?.StartDate && (
            <div className="text-[11px] text-muted">
              {timeLabel(prog.StartDate)} – {timeLabel(prog.EndDate)}
            </div>
          )}
          {pct > 0 && (
            <div className="mt-1.5 h-1 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <Play className="size-4 flex-none text-accent opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </div>
  );
}

function RecordingRow({
  rec,
  onPlay,
}: {
  rec: BaseItemDto;
  onPlay: () => void;
}) {
  const t = useTranslations("Common");
  const img = thumbUrl(rec, { maxWidth: 240 });
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-3.5">
      <div
        className="relative aspect-video w-[120px] flex-none overflow-hidden rounded-lg bg-cover bg-center"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(rec.Id)}`
            : gradientFallback(rec.Id),
        }}
      >
        <span className="absolute top-1.5 left-1.5 size-2.5 rounded-full bg-danger-soft" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-bold">{rec.Name}</div>
        <div className="truncate text-[12px] text-muted">
          {[rec.ChannelName, rec.ProductionYear].filter(Boolean).join(" · ")}
        </div>
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[13px] font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
      >
        <Play className="size-4 fill-current" /> {t("play")}
      </button>
    </div>
  );
}

function Empty({ icon, text }: { icon: "tv" | "radio"; text: string }) {
  const Icon = icon === "tv" ? Tv : Radio;
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-muted">
        <Icon className="size-6" />
      </span>
      <p className="max-w-md text-sm text-muted">{text}</p>
    </div>
  );
}
