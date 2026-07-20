"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { usePlayer } from "@/lib/player/store";
import { audioStreamUrl } from "@/lib/jellyfin/playback";
import { formatClock, gradientFallback } from "@/lib/jellyfin/media";

/** Persistent audio player bar; owns the single <audio> element for music. */
export function NowPlayingBar() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const stop = usePlayer((s) => s.stop);

  const current = queue[index];
  const trackId = current?.id;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Swap source when the track changes; honour the current play state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackId) return;
    audio.src = audioStreamUrl(trackId);
    audio.load();
    if (usePlayer.getState().isPlaying) audio.play().catch(() => {});
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
        onEnded={next}
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
            aria-label="Shuffle"
            className="hidden text-muted transition-colors hover:text-bright sm:block"
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
            aria-label="Repeat"
            className="hidden text-muted transition-colors hover:text-bright sm:block"
          >
            <Repeat className="size-[17px]" />
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
