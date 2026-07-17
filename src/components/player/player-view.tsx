"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Captions,
  Check,
  ChevronLeft,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  ScanFace,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useItem } from "@/lib/jellyfin/queries";
import { backdropUrl, formatClock, ticksToSeconds } from "@/lib/jellyfin/media";
import {
  getPlaybackInfo,
  reportProgress,
  reportStart,
  reportStopped,
  resolvePlayback,
  secondsToTicks,
} from "@/lib/jellyfin/playback";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const BITRATES = [
  { label: "Auto", value: 120_000_000 },
  { label: "1080p", value: 8_000_000 },
  { label: "720p", value: 4_000_000 },
  { label: "480p", value: 1_500_000 },
];

type Menu = "none" | "tracks" | "settings" | "scenes";

export function PlayerView({ itemId }: { itemId: string }) {
  const t = useTranslations("Player");
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { data: item } = useItem(itemId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{
    playSessionId?: string;
    source?: MediaSourceInfo;
  }>({});
  const startedRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState<Menu>("none");
  const [showControls, setShowControls] = useState(true);
  const [audioIndex, setAudioIndex] = useState<number | undefined>();
  const [subIndex, setSubIndex] = useState<number>(-1);
  const [bitrate, setBitrate] = useState(120_000_000);
  const [source, setSource] = useState<MediaSourceInfo | undefined>();

  const audioStreams =
    source?.MediaStreams?.filter((s) => String(s.Type) === "Audio") ?? [];
  const subStreams =
    source?.MediaStreams?.filter((s) => String(s.Type) === "Subtitle") ?? [];

  const initPlayback = useCallback(
    async (
      startSeconds: number,
      opts?: { audio?: number; sub?: number; bitrate?: number },
    ) => {
      const video = videoRef.current;
      if (!video) return;
      setReady(false);
      setError(false);
      try {
        const info = await getPlaybackInfo(itemId, {
          userId,
          startTimeTicks: secondsToTicks(startSeconds),
          audioStreamIndex: opts?.audio,
          subtitleStreamIndex: opts?.sub === -1 ? undefined : opts?.sub,
          maxStreamingBitrate: opts?.bitrate ?? bitrate,
        });
        const src = info.MediaSources?.[0];
        if (!src) {
          setError(true);
          return;
        }
        sessionRef.current = {
          playSessionId: info.PlaySessionId ?? undefined,
          source: src,
        };
        setSource(src);
        const { url, isHls } = resolvePlayback(itemId, src);

        hlsRef.current?.destroy();
        hlsRef.current = null;

        if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(url);
            hls.attachMedia(video);
            hlsRef.current = hls;
          } else {
            video.src = url;
          }
        } else {
          video.src = url;
        }
        video.currentTime = 0;
        video.playbackRate = rate;
        await video.play().catch(() => {});
        setReady(true);
      } catch {
        setError(true);
      }
    },
    [itemId, userId, bitrate, rate],
  );

  // Initial load once item metadata is available (for resume position).
  useEffect(() => {
    if (!item) return;
    const resumeSeconds = ticksToSeconds(item.UserData?.PlaybackPositionTicks);
    void initPlayback(resumeSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.Id]);

  // Progress reporting + teardown.
  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      reportProgress({
        ItemId: itemId,
        MediaSourceId: sessionRef.current.source?.Id ?? undefined,
        PlaySessionId: sessionRef.current.playSessionId,
        PositionTicks: secondsToTicks(video.currentTime),
        IsPaused: false,
      });
    }, 10_000);
    return () => {
      clearInterval(timer);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      const video = videoRef.current;
      reportStopped({
        ItemId: itemId,
        MediaSourceId: sessionRef.current.source?.Id ?? undefined,
        PlaySessionId: sessionRef.current.playSessionId,
        PositionTicks: secondsToTicks(video?.currentTime ?? 0),
      });
      hlsRef.current?.destroy();
    };
  }, [itemId]);

  // Auto-hide controls after inactivity (started on first mouse move).
  const nudgeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setShowControls(false);
    }, 3200);
  }, []);

  function onVideoEvent() {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(!video.paused);
    setTime(video.currentTime);
    setDuration(video.duration || 0);
    if (video.buffered.length) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
    if (!startedRef.current && !video.paused) {
      startedRef.current = true;
      reportStart({
        ItemId: itemId,
        MediaSourceId: sessionRef.current.source?.Id ?? undefined,
        PlaySessionId: sessionRef.current.playSessionId,
        PositionTicks: secondsToTicks(video.currentTime),
      });
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
    nudgeControls();
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(
      0,
      Math.min(seconds, video.duration || seconds),
    );
    nudgeControls();
  }

  function onScrub(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * (duration || 0));
  }

  function changeVolume(v: number) {
    const video = videoRef.current;
    setVolume(v);
    setMuted(v === 0);
    if (video) {
      video.volume = v;
      video.muted = v === 0;
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
  }

  function changeRate(r: number) {
    setRate(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
    setMenu("none");
  }

  function selectAudio(index: number) {
    setAudioIndex(index);
    void initPlayback(videoRef.current?.currentTime ?? 0, {
      audio: index,
      sub: subIndex,
    });
    setMenu("none");
  }
  function selectSub(index: number) {
    setSubIndex(index);
    void initPlayback(videoRef.current?.currentTime ?? 0, {
      audio: audioIndex,
      sub: index,
    });
    setMenu("none");
  }
  function selectBitrate(value: number) {
    setBitrate(value);
    void initPlayback(videoRef.current?.currentTime ?? 0, {
      audio: audioIndex,
      sub: subIndex,
      bitrate: value,
    });
    setMenu("none");
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => {});
  }
  function togglePip() {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.requestPictureInPicture?.().catch(() => {});
  }

  const backdrop = item ? backdropUrl(item, { maxWidth: 1600 }) : null;
  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={nudgeControls}
      className="fixed inset-0 z-50 overflow-hidden bg-black select-none"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        onClick={togglePlay}
        onTimeUpdate={onVideoEvent}
        onProgress={onVideoEvent}
        onPlay={onVideoEvent}
        onPause={onVideoEvent}
        onLoadedMetadata={onVideoEvent}
        onError={() => setError(true)}
        playsInline
      />

      {!ready && !error && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop ? `url("${backdrop}")` : undefined,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="size-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center">
          <div>
            <p className="mb-4 text-lg font-semibold">{t("error")}</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg bg-white px-6 py-2.5 font-bold text-on-accent"
            >
              <ChevronLeft className="mr-1 inline size-4" />
              {item?.Name}
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Top bar */}
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-4 bg-gradient-to-b from-black/70 to-transparent px-8 py-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-[10px] bg-white/[0.12] text-white hover:bg-white/25"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div>
            <div className="text-[19px] font-extrabold">{item?.Name}</div>
            <div className="text-[12.5px] text-para">
              {item?.Type === "Episode"
                ? `${item.SeriesName} · S${item.ParentIndexNumber}·E${item.IndexNumber}`
                : item?.ProductionYear}
            </div>
          </div>
        </div>

        {/* Center transport */}
        <div className="absolute inset-0 flex items-center justify-center gap-12">
          <button
            type="button"
            onClick={() => seekTo(time - 10)}
            aria-label="Back 10s"
            className="pointer-events-auto flex size-[58px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCcw className="size-6" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="pointer-events-auto flex size-[86px] items-center justify-center rounded-full bg-white text-on-accent shadow-2xl"
          >
            {playing ? (
              <Pause className="size-9 fill-current" />
            ) : (
              <Play className="size-9 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => seekTo(time + 10)}
            aria-label="Forward 10s"
            className="pointer-events-auto flex size-[58px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCw className="size-6" />
          </button>
        </div>

        {/* Menus */}
        {menu !== "none" && (
          <div className="pointer-events-auto absolute right-10 bottom-32 z-30 max-h-[58vh] w-[308px] overflow-y-auto rounded-2xl border border-border-strong bg-bg/95 p-3 shadow-2xl">
            {menu === "tracks" && (
              <TrackMenu
                subLabel={t("subtitles")}
                audioLabel={t("audio")}
                offLabel={t("off")}
                subs={subStreams.map((s) => ({
                  index: s.Index ?? -1,
                  label: s.DisplayTitle ?? s.Language ?? "",
                }))}
                audios={audioStreams.map((s) => ({
                  index: s.Index ?? -1,
                  label: s.DisplayTitle ?? s.Language ?? "",
                  codec: s.Codec ?? undefined,
                }))}
                subIndex={subIndex}
                audioIndex={audioIndex}
                onSub={selectSub}
                onAudio={selectAudio}
              />
            )}
            {menu === "settings" && (
              <SettingsMenu
                qualityLabel={t("quality")}
                speedLabel={t("speed")}
                bitrate={bitrate}
                rate={rate}
                onBitrate={selectBitrate}
                onRate={changeRate}
              />
            )}
            {menu === "scenes" && (
              <div>
                <MenuHeading>{t("chapters")}</MenuHeading>
                {(item?.Chapters ?? []).map((ch, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      seekTo(ticksToSeconds(ch.StartPositionTicks));
                      setMenu("none");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-white/[0.06]"
                  >
                    <span className="text-accent tabular-nums">
                      {formatClock(ticksToSeconds(ch.StartPositionTicks))}
                    </span>
                    <span className="truncate font-semibold">{ch.Name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-10 pt-7 pb-8">
          <div className="mb-4 flex items-center gap-4">
            <span className="w-16 flex-none text-right text-[12.5px] font-semibold text-bright tabular-nums">
              {formatClock(time)}
            </span>
            <div
              onClick={onScrub}
              className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${bufPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${pct}%` }}
              />
            </div>
            <span className="w-16 flex-none text-[12.5px] font-semibold text-muted tabular-nums">
              {formatClock(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <IconBtn onClick={togglePlay} label="Play/Pause">
              {playing ? (
                <Pause className="size-5" />
              ) : (
                <Play className="size-5" />
              )}
            </IconBtn>
            <div className="flex items-center gap-2 px-2">
              <IconBtn onClick={toggleMute} label="Mute">
                {muted ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </IconBtn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-24 accent-accent"
              />
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {item?.Chapters?.length ? (
                <TextBtn
                  active={menu === "scenes"}
                  onClick={() =>
                    setMenu((m) => (m === "scenes" ? "none" : "scenes"))
                  }
                >
                  <ScanFace className="size-4" /> {t("sceneInfo")}
                </TextBtn>
              ) : null}
              <TextBtn
                active={menu === "tracks"}
                onClick={() =>
                  setMenu((m) => (m === "tracks" ? "none" : "tracks"))
                }
              >
                <Captions className="size-4" /> {t("subtitles")}
              </TextBtn>
              <IconBtn
                active={menu === "settings"}
                onClick={() =>
                  setMenu((m) => (m === "settings" ? "none" : "settings"))
                }
                label="Settings"
              >
                <Settings className="size-[18px]" />
              </IconBtn>
              <IconBtn onClick={togglePip} label="Picture in picture">
                <PictureInPicture2 className="size-[18px]" />
              </IconBtn>
              <IconBtn onClick={toggleFullscreen} label="Fullscreen">
                <Maximize className="size-[18px]" />
              </IconBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-[10px] text-white transition-colors",
        active ? "bg-white/25" : "bg-white/[0.08] hover:bg-white/[0.16]",
      )}
    >
      {children}
    </button>
  );
}

function TextBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-2 rounded-[10px] px-3.5 text-[12.5px] font-semibold text-white transition-colors",
        active ? "bg-white/25" : "bg-white/[0.08] hover:bg-white/[0.16]",
      )}
    >
      {children}
    </button>
  );
}

function MenuHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-2 mt-1 mb-1.5 text-[11.5px] font-extrabold tracking-wide text-muted uppercase">
      {children}
    </div>
  );
}

function MenuRow({
  label,
  meta,
  on,
  onClick,
}: {
  label: string;
  meta?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-white/[0.06]"
    >
      <Check
        className={cn(
          "size-4 flex-none text-accent",
          on ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="flex-1 truncate text-[13px] font-semibold">{label}</span>
      {meta && <span className="text-[11px] text-muted">{meta}</span>}
    </button>
  );
}

function TrackMenu({
  subLabel,
  audioLabel,
  offLabel,
  subs,
  audios,
  subIndex,
  audioIndex,
  onSub,
  onAudio,
}: {
  subLabel: string;
  audioLabel: string;
  offLabel: string;
  subs: { index: number; label: string }[];
  audios: { index: number; label: string; codec?: string }[];
  subIndex: number;
  audioIndex?: number;
  onSub: (i: number) => void;
  onAudio: (i: number) => void;
}) {
  return (
    <div>
      <MenuHeading>{subLabel}</MenuHeading>
      <MenuRow
        label={offLabel}
        on={subIndex === -1}
        onClick={() => onSub(-1)}
      />
      {subs.map((s) => (
        <MenuRow
          key={s.index}
          label={s.label}
          on={subIndex === s.index}
          onClick={() => onSub(s.index)}
        />
      ))}
      <div className="mx-1 my-2 h-px bg-white/10" />
      <MenuHeading>{audioLabel}</MenuHeading>
      {audios.map((a, i) => (
        <MenuRow
          key={a.index}
          label={a.label}
          meta={a.codec?.toUpperCase()}
          on={audioIndex != null ? audioIndex === a.index : i === 0}
          onClick={() => onAudio(a.index)}
        />
      ))}
    </div>
  );
}

function SettingsMenu({
  qualityLabel,
  speedLabel,
  bitrate,
  rate,
  onBitrate,
  onRate,
}: {
  qualityLabel: string;
  speedLabel: string;
  bitrate: number;
  rate: number;
  onBitrate: (v: number) => void;
  onRate: (v: number) => void;
}) {
  return (
    <div>
      <MenuHeading>{qualityLabel}</MenuHeading>
      {BITRATES.map((b) => (
        <MenuRow
          key={b.value}
          label={b.label}
          on={bitrate === b.value}
          onClick={() => onBitrate(b.value)}
        />
      ))}
      <div className="mx-1 my-2 h-px bg-white/10" />
      <MenuHeading>{speedLabel}</MenuHeading>
      {SPEEDS.map((s) => (
        <MenuRow
          key={s}
          label={`${s}×`}
          on={rate === s}
          onClick={() => onRate(s)}
        />
      ))}
    </div>
  );
}
