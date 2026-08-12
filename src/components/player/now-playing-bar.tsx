"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { usePlayer } from "@/lib/player/store";
import { audioStreamUrl } from "@/lib/jellyfin/playback";
import {
  disableDirectMedia,
  getMediaCredentials,
  isDirectMediaDisabled,
} from "@/lib/jellyfin/direct";
import { formatClock, gradientFallback } from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

/** Persistent audio player bar; owns the single <audio> element for music. */
export function NowPlayingBar() {
  const t = useTranslations("Common");
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const stop = usePlayer((s) => s.stop);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);

  const current = queue[index];
  const trackId = current?.id;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  // Retry a failed direct stream once through the proxy (CORS, mixed content,
  // an unreachable port); the flag is shared with the video player.
  const fellBackRef = useRef(false);

  function handleAudioError() {
    const audio = audioRef.current;
    if (fellBackRef.current || isDirectMediaDisabled() || !audio || !trackId)
      return;
    fellBackRef.current = true;
    disableDirectMedia();
    const at = audio.currentTime;
    audio.crossOrigin = null;
    audio.src = audioStreamUrl(trackId, null);
    // currentTime can only be set once the new source reports its duration.
    if (at > 0) {
      audio.addEventListener(
        "loadedmetadata",
        () => {
          audio.currentTime = at;
        },
        { once: true },
      );
    }
    audio.load();
    if (usePlayer.getState().isPlaying) void audio.play().catch(() => {});
  }

  // Swap source when the track changes; honour the current play state. Audio
  // streams straight from Jellyfin when possible, same as video.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackId) return;
    let cancelled = false;
    void getMediaCredentials().then((creds) => {
      if (cancelled) return;
      audio.crossOrigin = creds ? "anonymous" : null;
      audio.src = audioStreamUrl(trackId, creds);
      audio.load();
      if (usePlayer.getState().isPlaying) void audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  // Follow play/pause from the store.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying]);

  if (!current) return null;

  const progress = duration ? (position / duration) * 100 : 0;

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setPosition(ratio * duration);
  }

  return (
    <div className="sticky bottom-0 z-30 flex h-[72px] flex-none items-center gap-4 border-t border-border bg-nav px-4 backdrop-blur-md md:gap-6 md:px-6">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onDurationChange={(e) =>
          setDuration(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0,
          )
        }
        onEnded={() => {
          // "Repeat one" keeps the same queue index, so the track-change effect
          // would never fire — restart the element here instead.
          const audio = audioRef.current;
          if (usePlayer.getState().repeat === "one" && audio) {
            audio.currentTime = 0;
            void audio.play().catch(() => {});
            return;
          }
          next();
        }}
        onError={handleAudioError}
      />

      {/* Track */}
      <div className="flex w-[220px] min-w-0 flex-none items-center gap-3">
        <span
          className="size-12 flex-none rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: current.coverUrl
              ? `url("${current.coverUrl}"), ${gradientFallback(current.id)}`
              : gradientFallback(current.id),
          }}
        />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-bold">{current.name}</div>
          <div className="truncate text-[11.5px] text-muted">
            {current.artist}
          </div>
        </div>
      </div>

      {/* Controls + scrubber */}
      <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-center gap-1.5">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label={t("shuffle")}
            title={t("shuffle")}
            aria-pressed={shuffle}
            className={cn(
              "hidden transition-colors hover:text-bright sm:block",
              shuffle ? "text-accent hover:text-accent" : "text-muted",
            )}
          >
            <Shuffle className="size-[17px]" />
          </button>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="text-bright transition-colors hover:text-text"
          >
            <SkipBack className="size-[19px]" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex size-9 items-center justify-center rounded-full bg-white text-on-accent transition-transform hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="size-[18px] fill-current" />
            ) : (
              <Play className="size-[18px] translate-x-px fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="text-bright transition-colors hover:text-text"
          >
            <SkipForward className="size-[19px]" />
          </button>
          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={repeat === "one" ? t("repeatOne") : t("repeat")}
            title={repeat === "one" ? t("repeatOne") : t("repeat")}
            aria-pressed={repeat !== "off"}
            className={cn(
              "hidden transition-colors hover:text-bright sm:block",
              repeat !== "off" ? "text-accent hover:text-accent" : "text-muted",
            )}
          >
            {repeat === "one" ? (
              <Repeat1 className="size-[17px]" />
            ) : (
              <Repeat className="size-[17px]" />
            )}
          </button>
        </div>
        <div className="flex w-full items-center gap-2.5">
          <span className="w-9 text-right text-[11px] text-muted tabular-nums">
            {formatClock(position)}
          </span>
          <div
            onClick={seek}
            className="group/scrub relative h-1 flex-1 cursor-pointer rounded-full bg-white/20"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 text-[11px] text-muted tabular-nums">
            {formatClock(duration)}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="hidden w-[220px] flex-none items-center justify-end gap-3 lg:flex">
        <Volume2 className="size-[18px] text-muted" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          defaultValue={1}
          onChange={(e) => {
            if (audioRef.current)
              audioRef.current.volume = Number(e.target.value);
          }}
          aria-label="Volume"
          className="h-1 w-24 accent-accent"
        />
        <button
          type="button"
          onClick={stop}
          aria-label="Close player"
          className="text-muted transition-colors hover:text-text"
        >
          <X className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}
