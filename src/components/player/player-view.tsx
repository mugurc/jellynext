"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Captions,
  Check,
  ChevronLeft,
  Download,
  Keyboard,
  Loader2,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  ScanFace,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type {
  MediaSourceInfo,
  MediaStream,
} from "@jellyfin/sdk/lib/generated-client";
import { Logo } from "@/components/brand/logo";
import { useCurrentUser } from "@/lib/auth/current-user";
import { usePrefs } from "@/lib/prefs/store";
import { usePlayQueue, queueNeighbours } from "@/lib/player/queue";
import { useRemoteControl } from "@/lib/player/remote-control";
import { useSyncPlay } from "@/lib/player/syncplay";
import {
  useSyncPlayGroups,
  useSyncPlayJoin,
  useSyncPlayLeave,
  useSyncPlayNew,
  syncPlayPause,
  syncPlaySeek,
  syncPlaySetQueue,
  syncPlayUnpause,
  type SyncPlayGroup,
} from "@/lib/jellyfin/syncplay-queries";
import {
  languageAtIndex,
  pickAudioIndex,
  pickSubtitleIndex,
} from "@/lib/jellyfin/tracks";
import { useItem } from "@/lib/jellyfin/queries";
import {
  useAdjacentEpisodes,
  useDeleteSubtitle,
  useDownloadRemoteSubtitle,
  useMediaSegments,
  useRemoteSubtitleSearch,
  useUploadSubtitle,
  type RemoteSubtitleInfo,
} from "@/lib/jellyfin/player-queries";
import { backdropUrl, formatClock, ticksToSeconds } from "@/lib/jellyfin/media";
import {
  getPlaybackInfo,
  reportProgress,
  reportStart,
  reportStopped,
  resolvePlayback,
  secondsToTicks,
  subtitleTrackUrl,
} from "@/lib/jellyfin/playback";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CUE_SIZE: Record<string, string> = {
  small: "2.6vh",
  medium: "3.6vh",
  large: "5vh",
};
const BITRATES = [
  { label: "Auto", value: 120_000_000 },
  { label: "1080p", value: 8_000_000 },
  { label: "720p", value: 4_000_000 },
  { label: "480p", value: 1_500_000 },
];

type Menu = "none" | "tracks" | "settings" | "scenes" | "sync";

/** Push a text track's cues to the top of the frame (for a secondary sub). */
function positionCuesTop(track: TextTrack) {
  const cues = track.cues;
  if (!cues) return;
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i] as VTTCue;
    try {
      cue.snapToLines = true;
      cue.line = 1;
    } catch {
      // Some cue kinds reject line positioning — leave them at the default.
    }
  }
}

export function PlayerView({ itemId }: { itemId: string }) {
  const t = useTranslations("Player");
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { data: item } = useItem(itemId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryTrackRef = useRef<HTMLTrackElement>(null);
  const secondaryTrackRef = useRef<HTMLTrackElement>(null);
  const sessionRef = useRef<{
    playSessionId?: string;
    source?: MediaSourceInfo;
  }>({});
  const startedRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Absolute seconds to seek to once metadata is ready (direct / native-HLS).
  const pendingSeekRef = useRef<number | null>(null);
  // Bumped on every (re)load so a superseded load can't stomp newer state or
  // leave a play()/pause() race unhandled.
  const loadTokenRef = useRef(0);
  // Mirrors whether a menu is open, read inside the auto-hide timer.
  const menuOpenRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [buffering, setBuffering] = useState(false);
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
  const [secondarySubIndex, setSecondarySubIndex] = useState<number>(-1);
  const [bitrate, setBitrate] = useState(120_000_000);
  const [source, setSource] = useState<MediaSourceInfo | undefined>();
  const [playMethod, setPlayMethod] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [skippedSegments, setSkippedSegments] = useState<string[]>([]);
  const [fit, setFit] = useState<"contain" | "cover" | "fill">("contain");
  const [subDelay, setSubDelay] = useState(0);
  const [boost, setBoost] = useState(1);
  const [showRemaining, setShowRemaining] = useState(false);
  // Subtitle stream index currently BURNED into the server transcode (image
  // subs like PGS/VOBSUB can't render in a <track>), or -1 for none.
  const [burnIndex, setBurnIndex] = useState(-1);
  // Applied cue shift (seconds) so a delay change only moves cues by the delta.
  const subDelayRef = useRef(0);
  // Lazily-built Web Audio graph for volume boost + dynamic-range normalize.
  const audioGraphRef = useRef<{
    ctx: AudioContext;
    compressor: DynamicsCompressorNode;
    gain: GainNode;
  } | null>(null);
  const audioNormalize = usePrefs((s) => s.audioNormalize);

  const subtitleSize = usePrefs((s) => s.subtitleSize);
  const autoplayNext = usePrefs((s) => s.autoplayNext);
  const syncGroupId = useSyncPlay((s) => s.groupId);

  const isEpisode = item?.Type === "Episode";
  const segmentsQuery = useMediaSegments(itemId);
  const adjacent = useAdjacentEpisodes(
    isEpisode ? (item?.SeriesId ?? undefined) : undefined,
    isEpisode ? itemId : undefined,
  );
  const nextEp = adjacent.data?.next ?? null;
  const prevEp = adjacent.data?.previous ?? null;
  const deleteSub = useDeleteSubtitle();

  // Play queue (a series/collection/playlist the user started). When the
  // current item is in it, it drives prev/next/autoplay; otherwise we fall
  // back to episode adjacency.
  const queueIds = usePlayQueue((s) => s.ids);
  const queueTitle = usePlayQueue((s) => s.title);
  const queueNav = queueNeighbours(queueIds, itemId);
  const nextId = queueNav.next ?? nextEp?.Id ?? null;
  const prevId = queueNav.prev ?? prevEp?.Id ?? null;
  // Mirror for the once-attached keyboard handler (avoids a stale closure).
  const navRef = useRef<{ next: string | null; prev: string | null }>({
    next: null,
    prev: null,
  });
  navRef.current = { next: nextId, prev: prevId };

  const audioStreams =
    source?.MediaStreams?.filter((s) => String(s.Type) === "Audio") ?? [];
  const subStreams =
    source?.MediaStreams?.filter((s) => String(s.Type) === "Subtitle") ?? [];

  // The intro/outro/recap segment covering the current position, if any and
  // not already dismissed — drives the Skip button.
  const activeSegment = (segmentsQuery.data?.Items ?? []).find(
    (s) =>
      !skippedSegments.includes(s.Id) &&
      time >= ticksToSeconds(s.StartTicks) &&
      time < ticksToSeconds(s.EndTicks) - 0.5,
  );

  const activeSubStream =
    subIndex >= 0
      ? subStreams.find((s) => (s.Index ?? -1) === subIndex)
      : undefined;
  // Text subtitles render in a <track>; image subs (PGS/VOBSUB) can't and are
  // simply skipped rather than forcing a burn-in transcode.
  const showTrack = Boolean(
    activeSubStream &&
    (activeSubStream.IsTextSubtitleStream ?? true) &&
    source?.Id,
  );
  const activeSubUrl =
    showTrack && source?.Id
      ? subtitleTrackUrl(itemId, source.Id, subIndex)
      : null;

  // Optional second subtitle (dual language) — text-only, distinct from the
  // primary, rendered in its own <track> positioned near the top.
  const secondarySubStream =
    secondarySubIndex >= 0
      ? subStreams.find((s) => (s.Index ?? -1) === secondarySubIndex)
      : undefined;
  const showSecondary = Boolean(
    secondarySubStream &&
    (secondarySubStream.IsTextSubtitleStream ?? true) &&
    source?.Id &&
    secondarySubIndex !== subIndex,
  );
  const secondarySubUrl =
    showSecondary && source?.Id
      ? subtitleTrackUrl(itemId, source.Id, secondarySubIndex)
      : null;

  const initPlayback = useCallback(
    async (
      startSeconds: number,
      opts?: { audio?: number; bitrate?: number; subtitle?: number },
    ) => {
      const video = videoRef.current;
      if (!video) return;
      const token = ++loadTokenRef.current;
      // Cleanly stop any in-flight playback before swapping the source so the
      // previous (caught) play() promise settles without an unhandled abort.
      if (!video.paused) video.pause();
      setReady(false);
      setError(false);
      try {
        // Subtitles are rendered client-side via <track>, so they are never
        // requested here — audio/quality are the only server-side variables.
        const info = await getPlaybackInfo(itemId, {
          userId,
          startTimeTicks: secondsToTicks(startSeconds),
          audioStreamIndex: opts?.audio,
          subtitleStreamIndex: opts?.subtitle,
          maxStreamingBitrate: opts?.bitrate ?? bitrate,
        });
        if (token !== loadTokenRef.current) return; // superseded by a newer load
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
        setPlayMethod(
          isHls
            ? "Transcode"
            : src.SupportsDirectPlay
              ? "Direct Play"
              : "Direct Stream",
        );
        // Fresh source → the <track>s reload at original cue times.
        subDelayRef.current = 0;
        setSubDelay(0);
        setSecondarySubIndex(-1);

        hlsRef.current?.destroy();
        hlsRef.current = null;

        // Jellyfin HLS is a full-timeline VOD playlist (segments span 0..total,
        // transcoded on demand), so element time IS the absolute media time and
        // every position is seekable — there is no stream offset. We resume by
        // real time: hls.js via `startPosition`, direct/native-HLS via a seek.
        const usingHlsJs =
          isHls && !video.canPlayType("application/vnd.apple.mpegurl");

        if (usingHlsJs) {
          const Hls = (await import("hls.js")).default;
          if (token !== loadTokenRef.current) return;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              startPosition: startSeconds > 0 ? startSeconds : -1,
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            hlsRef.current = hls;
            pendingSeekRef.current = null;
          } else {
            video.src = url;
            pendingSeekRef.current = startSeconds > 0 ? startSeconds : null;
          }
        } else {
          // Direct file: a #t= media fragment is the most reliable resume.
          video.src =
            !isHls && startSeconds > 0
              ? `${url}#t=${Math.floor(startSeconds)}`
              : url;
          pendingSeekRef.current = startSeconds > 0 ? startSeconds : null;
        }

        video.playbackRate = rate;
        await video.play().catch(() => {});
        if (token !== loadTokenRef.current) return;
        setReady(true);
      } catch {
        if (token === loadTokenRef.current) setError(true);
      }
    },
    [itemId, userId, bitrate, rate],
  );

  // Initial load once item metadata is available. Honours the remembered
  // audio/subtitle language preferences and the resume position.
  useEffect(() => {
    if (!item) return;
    const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
    const audios = streams.filter((s) => String(s.Type) === "Audio");
    const subs = streams.filter((s) => String(s.Type) === "Subtitle");
    const prefs = usePrefs.getState();
    // An explicit pre-play track choice for this item wins; otherwise fall
    // back to the remembered language preference.
    const choice =
      prefs.audioTrackChoice && prefs.audioTrackChoice.itemId === item.Id
        ? prefs.audioTrackChoice.index
        : undefined;
    const initAudio =
      choice != null && audios.some((s) => s.Index === choice)
        ? choice
        : pickAudioIndex(audios, prefs.audioLang);
    setAudioIndex(initAudio);
    const initSub = pickSubtitleIndex(subs, prefs.subtitleLang);
    setSubIndex(initSub);
    // A remembered image subtitle must be burned into the initial transcode.
    const initSubStream =
      initSub >= 0 ? subs.find((s) => (s.Index ?? -1) === initSub) : undefined;
    const initBurn =
      initSub >= 0 && !(initSubStream?.IsTextSubtitleStream ?? true)
        ? initSub
        : -1;
    setBurnIndex(initBurn);
    const resumeSeconds = ticksToSeconds(item.UserData?.PlaybackPositionTicks);
    void initPlayback(resumeSeconds, {
      audio: initAudio,
      subtitle: initBurn >= 0 ? initBurn : undefined,
    });
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

  // Keep the rendered <track>s visible (browsers default new tracks to
  // disabled, and a source reload resets track state). The secondary track's
  // cues are pushed to the top so the two languages don't overlap.
  useEffect(() => {
    const pt = primaryTrackRef.current?.track;
    if (pt) pt.mode = showTrack ? "showing" : "disabled";
    const st = secondaryTrackRef.current?.track;
    if (st) {
      st.mode = showSecondary ? "showing" : "disabled";
      if (showSecondary) positionCuesTop(st);
    }
  }, [showTrack, showSecondary, subIndex, secondarySubIndex, source]);

  // Reposition the secondary track's cues to the top once its VTT loads
  // (cues aren't available synchronously when the mode effect first runs).
  useEffect(() => {
    const el = secondaryTrackRef.current;
    if (!el || !showSecondary) return;
    const track = el.track;
    const reposition = () => positionCuesTop(track);
    reposition();
    el.addEventListener("load", reposition);
    return () => el.removeEventListener("load", reposition);
  }, [showSecondary, secondarySubIndex, source]);

  // Keep an open menu from being auto-hidden.
  useEffect(() => {
    menuOpenRef.current = menu !== "none";
  }, [menu]);

  // Auto-hide controls after inactivity — never while paused or a menu is open.
  const nudgeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused && !menuOpenRef.current) {
        setShowControls(false);
      }
    }, 3200);
  }, []);

  // Keyboard shortcuts (attached once; reads live state from the element).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      const video = videoRef.current;
      const at = video?.currentTime ?? 0;
      const vol = video?.volume ?? 1;
      // Read totals/rate live from the element so this once-attached handler
      // isn't stale (element values update even when React state closes over).
      const total =
        video && Number.isFinite(video.duration) ? video.duration : 0;
      const bumpRate = (dir: -1 | 1) => {
        const now = video?.playbackRate ?? 1;
        const idx = SPEEDS.indexOf(now);
        const cur = idx === -1 ? SPEEDS.indexOf(1) : idx;
        changeRate(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, cur + dir))]);
      };

      // 0–9 → jump to 0%…90% of the runtime (classic).
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        if (total) seekTo((Number(e.key) / 10) * total);
        nudgeControls();
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekTo(at - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekTo(at + 5);
          break;
        case "j":
        case "J":
          seekTo(at - 10);
          break;
        case "l":
        case "L":
          seekTo(at + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(Math.min(1, Math.round((vol + 0.1) * 100) / 100));
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(Math.max(0, Math.round((vol - 0.1) * 100) / 100));
          break;
        case "Home":
          e.preventDefault();
          seekTo(0);
          break;
        case "End":
          e.preventDefault();
          if (total) seekTo(total);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "c":
        case "C":
          toggleSubtitles();
          break;
        case "p":
        case "i":
        case "I":
          togglePip();
          break;
        case "<":
          bumpRate(-1);
          break;
        case ">":
          bumpRate(1);
          break;
        case "N": // Shift+N — next (episode / queue)
          if (navRef.current.next) router.push(`/watch/${navRef.current.next}`);
          break;
        case "P": // Shift+P — previous (episode / queue)
          if (navRef.current.prev) router.push(`/watch/${navRef.current.prev}`);
          break;
        case "?":
          setShowHelp((v) => !v);
          break;
        case "Escape":
          if (menuOpenRef.current) setMenu("none");
          else setShowHelp(false);
          break;
        default:
          return;
      }
      nudgeControls();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply remote-control commands received over the Jellyfin WebSocket
  // (another client / dashboard driving this session's playback).
  const remoteCommand = useRemoteControl((s) => s.command);
  useEffect(() => {
    if (!remoteCommand) return;
    const video = videoRef.current;
    const vol = video?.volume ?? volume;
    switch (remoteCommand.action) {
      case "Pause":
        // A position (from SyncPlay) aligns us before pausing.
        if (remoteCommand.seekTicks != null && video)
          video.currentTime = remoteCommand.seekTicks / 10_000_000;
        video?.pause();
        break;
      case "Unpause":
        if (remoteCommand.seekTicks != null && video)
          video.currentTime = remoteCommand.seekTicks / 10_000_000;
        void video?.play().catch(() => {});
        break;
      case "PlayPause":
        togglePlay();
        break;
      case "Stop":
        router.back();
        break;
      case "Seek":
        if (remoteCommand.seekTicks != null)
          seekTo(remoteCommand.seekTicks / 10_000_000);
        break;
      case "NextTrack":
        goToNext();
        break;
      case "PreviousTrack":
        goToPrev();
        break;
      case "SetVolume":
        if (remoteCommand.volume != null)
          changeVolume(Math.max(0, Math.min(1, remoteCommand.volume / 100)));
        break;
      case "VolumeUp":
        changeVolume(Math.min(1, vol + 0.1));
        break;
      case "VolumeDown":
        changeVolume(Math.max(0, vol - 0.1));
        break;
      case "ToggleMute":
        toggleMute();
        break;
      case "Mute":
        if (video && !video.muted) toggleMute();
        break;
      case "Unmute":
        if (video && video.muted) toggleMute();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteCommand]);

  // Tear down the Web Audio graph only on real unmount (the element persists
  // across episode changes, so its MediaElementSource must not be recreated).
  useEffect(() => {
    return () => {
      audioGraphRef.current?.ctx.close().catch(() => {});
      audioGraphRef.current = null;
    };
  }, []);

  // Toggle a menu open/closed and keep the controls pinned while interacting.
  function toggleMenu(type: Menu) {
    setMenu((m) => (m === type ? "none" : type));
    nudgeControls();
  }
  function closeMenu() {
    setMenu("none");
    nudgeControls();
  }

  // Push the current play/pause state to the server so remote controllers
  // (admin dashboards) reflect it immediately on play/pause/seek.
  function reportPlaystate() {
    const video = videoRef.current;
    if (!video || !startedRef.current) return;
    reportProgress({
      ItemId: itemId,
      MediaSourceId: sessionRef.current.source?.Id ?? undefined,
      PlaySessionId: sessionRef.current.playSessionId,
      PositionTicks: secondsToTicks(video.currentTime),
      IsPaused: video.paused,
    });
  }

  function onVideoEvent() {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(!video.paused);
    setTime(video.currentTime);
    // Total is the item runtime (available immediately); fall back to the
    // element's own duration once known.
    setDuration(
      ticksToSeconds(item?.RunTimeTicks) ||
        (Number.isFinite(video.duration) ? video.duration : 0),
    );
    // Buffered-ahead: end of the range that currently contains the playhead
    // (falls back to the furthest buffered point before playback catches up).
    if (video.buffered.length) {
      const ct = video.currentTime;
      let bufferedEnd = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (
          video.buffered.start(i) - 0.5 <= ct &&
          ct <= video.buffered.end(i) + 0.5
        ) {
          bufferedEnd = video.buffered.end(i);
          break;
        }
      }
      if (!bufferedEnd) {
        bufferedEnd = video.buffered.end(video.buffered.length - 1);
      }
      setBuffered(bufferedEnd);
    }
    if (!startedRef.current && !video.paused) {
      startedRef.current = true;
      reportStart({
        ItemId: itemId,
        MediaSourceId: sessionRef.current.source?.Id ?? undefined,
        PlaySessionId: sessionRef.current.playSessionId,
        PositionTicks: secondsToTicks(video.currentTime),
      });
      // Honour a persisted normalize preference once real playback begins.
      if (usePrefs.getState().audioNormalize) {
        const g = ensureAudioGraph();
        if (g) {
          void g.ctx.resume();
          tuneCompressor(g, true);
        }
      }
    }
  }

  // Playback advancing means we're not buffering (timeupdate only fires when
  // currentTime actually changes), so clear any leftover buffering state here.
  function handleTimeUpdate() {
    onVideoEvent();
    setBuffering(false);
  }

  // Apply a pending resume seek for direct streams once the media is seekable.
  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (video && pendingSeekRef.current != null) {
      try {
        video.currentTime = pendingSeekRef.current;
      } catch {
        // Media not seekable yet — ignore; playback still starts near 0.
      }
      pendingSeekRef.current = null;
    }
    onVideoEvent();
  }

  /** Current media position in seconds. */
  function currentAbs(): number {
    return videoRef.current?.currentTime ?? 0;
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
      if (syncGroupId) syncPlayUnpause();
    } else {
      video.pause();
      if (syncGroupId) syncPlayPause();
    }
    nudgeControls();
  }

  // Clicking the surface closes an open menu; otherwise toggles playback.
  function onSurfaceClick() {
    if (menu !== "none") {
      closeMenu();
      return;
    }
    togglePlay();
  }

  function seekTo(target: number) {
    const video = videoRef.current;
    if (!video) return;
    // Element time is absolute for both direct files and Jellyfin's
    // full-timeline HLS, so any position is a plain currentTime seek — hls.js
    // fetches the target segment and the server transcodes it on demand.
    const total = duration || video.duration || target;
    const clamped = Math.max(0, Math.min(target, total));
    video.currentTime = clamped;
    if (syncGroupId) syncPlaySeek(secondsToTicks(clamped));
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
    // Remember the language (cross-item) and the exact track (this item), so
    // re-opening resumes on the same audio the viewer switched to.
    usePrefs.getState().set("audioLang", languageAtIndex(audioStreams, index));
    usePrefs.getState().set("audioTrackChoice", { itemId, index });
    // Switching audio needs a fresh server stream, resumed at the current spot.
    void initPlayback(currentAbs(), {
      audio: index,
      subtitle: burnIndex >= 0 ? burnIndex : undefined,
    });
    setMenu("none");
  }
  function selectSub(index: number) {
    const stream =
      index >= 0
        ? subStreams.find((s) => (s.Index ?? -1) === index)
        : undefined;
    const isText = index === -1 || (stream?.IsTextSubtitleStream ?? true);
    setSubIndex(index);
    // The secondary can't be the same stream as the primary.
    if (index >= 0 && index === secondarySubIndex) setSecondarySubIndex(-1);
    resetSubDelay();
    usePrefs
      .getState()
      .set(
        "subtitleLang",
        index === -1 ? "" : languageAtIndex(subStreams, index),
      );
    setMenu("none");

    if (isText) {
      // Text subs render client-side via the <track>. If an image sub was
      // burned into the transcode, drop it and re-init for a clean stream.
      if (burnIndex >= 0) {
        setBurnIndex(-1);
        void initPlayback(currentAbs(), {
          audio: audioIndex,
          subtitle: undefined,
        });
      }
    } else {
      // Image subs (PGS/VOBSUB) can't render in a <track>; burn them into the
      // server transcode instead.
      setBurnIndex(index);
      void initPlayback(currentAbs(), { audio: audioIndex, subtitle: index });
    }
  }
  function selectSecondary(index: number) {
    // Client-side only; a second <track> shows alongside the primary.
    setSecondarySubIndex((cur) => (cur === index ? -1 : index));
  }
  function selectBitrate(value: number) {
    setBitrate(value);
    void initPlayback(currentAbs(), {
      audio: audioIndex,
      bitrate: value,
      subtitle: burnIndex >= 0 ? burnIndex : undefined,
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

  function skipActiveSegment() {
    if (!activeSegment) return;
    setSkippedSegments((s) => [...s, activeSegment.Id]);
    seekTo(ticksToSeconds(activeSegment.EndTicks));
  }
  function goToNext() {
    if (nextId) router.push(`/watch/${nextId}`);
  }
  function goToPrev() {
    if (prevId) router.push(`/watch/${prevId}`);
  }
  function handleEnded() {
    if (autoplayNext && nextId) router.push(`/watch/${nextId}`);
  }
  function toggleSubtitles() {
    if (subIndex !== -1) {
      selectSub(-1);
      return;
    }
    const firstText = subStreams.find((s) => s.IsTextSubtitleStream ?? true);
    if (firstText?.Index != null) selectSub(firstText.Index);
  }

  // Reload playback (e.g. after adding a subtitle) keeping the current spot.
  function reloadCurrent() {
    void initPlayback(currentAbs(), {
      audio: audioIndex,
      bitrate,
      subtitle: burnIndex >= 0 ? burnIndex : undefined,
    });
  }

  // Subtitle timing offset (client-side): shift the rendered cues by the delta
  // so repeated adjustments stay correct. Reset to 0 whenever the track changes.
  function adjustSubDelay(next: number) {
    const clamped = Math.round(Math.max(-30, Math.min(30, next)) * 10) / 10;
    const delta = clamped - subDelayRef.current;
    const track = primaryTrackRef.current?.track;
    if (track?.cues) {
      for (let i = 0; i < track.cues.length; i++) {
        const cue = track.cues[i];
        cue.startTime = Math.max(0, cue.startTime + delta);
        cue.endTime = Math.max(0, cue.endTime + delta);
      }
    }
    subDelayRef.current = clamped;
    setSubDelay(clamped);
  }
  function resetSubDelay() {
    subDelayRef.current = 0;
    setSubDelay(0);
  }

  // Build the Web Audio graph once: source → compressor → gain → out. The
  // element persists across episodes so its MediaElementSource is created only
  // once (a second call throws), hence the ref cache.
  function ensureAudioGraph() {
    if (audioGraphRef.current) return audioGraphRef.current;
    const video = videoRef.current;
    if (!video) return null;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const srcNode = ctx.createMediaElementSource(video);
      const compressor = ctx.createDynamicsCompressor();
      const gain = ctx.createGain();
      srcNode.connect(compressor).connect(gain).connect(ctx.destination);
      audioGraphRef.current = { ctx, compressor, gain };
    } catch {
      return null;
    }
    return audioGraphRef.current;
  }

  // Passthrough compressor unless normalize is on (then it evens out the
  // dynamic range so quiet dialogue and loud effects sit closer together).
  function tuneCompressor(
    g: { compressor: DynamicsCompressorNode },
    on: boolean,
  ) {
    const c = g.compressor;
    c.threshold.value = on ? -34 : 0;
    c.knee.value = on ? 32 : 0;
    c.ratio.value = on ? 14 : 1;
    c.attack.value = 0.003;
    c.release.value = on ? 0.25 : 0;
  }

  // Volume boost beyond 100% via the gain node.
  function applyBoost(mult: number) {
    setBoost(mult);
    if (mult === 1 && !audioGraphRef.current) return;
    const g = ensureAudioGraph();
    if (!g) return;
    void g.ctx.resume();
    g.gain.gain.value = mult;
    tuneCompressor(g, audioNormalize);
  }

  function applyNormalize(on: boolean) {
    usePrefs.getState().set("audioNormalize", on);
    if (!on && !audioGraphRef.current) return;
    const g = ensureAudioGraph();
    if (!g) return;
    void g.ctx.resume();
    tuneCompressor(g, on);
  }

  function deleteSubtitle(index: number) {
    deleteSub.mutate({ itemId, index }, { onSuccess: reloadCurrent });
  }

  const backdrop = item ? backdropUrl(item, { maxWidth: 1600 }) : null;
  const clampPct = (v: number) =>
    Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  const pct = duration ? clampPct((time / duration) * 100) : 0;
  const bufPct = duration ? clampPct((buffered / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={nudgeControls}
      className="fixed inset-0 z-50 overflow-hidden bg-black select-none"
    >
      <style>{`video::cue{font-size:${CUE_SIZE[subtitleSize] ?? CUE_SIZE.medium};background:rgba(0,0,0,.45);line-height:1.3}`}</style>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        style={{ objectFit: fit }}
        onClick={onSurfaceClick}
        onTimeUpdate={handleTimeUpdate}
        onProgress={onVideoEvent}
        onPlay={() => {
          onVideoEvent();
          reportPlaystate();
        }}
        onPause={() => {
          onVideoEvent();
          reportPlaystate();
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onSeeked={() => {
          setBuffering(false);
          reportPlaystate();
        }}
        onEnded={handleEnded}
        onError={() => setError(true)}
        playsInline
      >
        {activeSubUrl && (
          <track
            ref={primaryTrackRef}
            key={`${source?.Id}-${subIndex}`}
            kind="subtitles"
            src={activeSubUrl}
            srcLang={activeSubStream?.Language ?? "und"}
            label={
              activeSubStream?.DisplayTitle ??
              activeSubStream?.Language ??
              "Subtitle"
            }
            default
          />
        )}
        {secondarySubUrl && (
          <track
            ref={secondaryTrackRef}
            key={`sec-${source?.Id}-${secondarySubIndex}`}
            kind="subtitles"
            src={secondarySubUrl}
            srcLang={secondarySubStream?.Language ?? "und"}
            label={
              secondarySubStream?.DisplayTitle ??
              secondarySubStream?.Language ??
              "Subtitle 2"
            }
          />
        )}
      </video>

      {/* Preload overlay: a softly breathing logo that fades away when ready. */}
      <div
        className={cn(
          "absolute inset-0 z-40 bg-black transition-opacity duration-700 ease-out",
          ready || error ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{ backgroundImage: `url("${backdrop}")` }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo size={60} wordmarkSize={44} className="animate-jn-breathe" />
        </div>
      </div>

      {/* Buffering: shown while waiting for data mid-playback (e.g. after a seek). */}
      {ready && !error && buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="size-14 animate-spin rounded-full border-[3px] border-white/25 border-t-white/90" />
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

      {/* Skip intro / credits — visible independent of the control bar. */}
      {ready && activeSegment && (
        <button
          type="button"
          onClick={skipActiveSegment}
          className="animate-jn-fade absolute right-10 bottom-28 z-40 flex items-center gap-2 rounded-lg border border-white/25 bg-black/75 px-5 py-3 text-[14px] font-bold text-white backdrop-blur-sm transition hover:bg-black/90"
        >
          <SkipForward className="size-4" />
          {activeSegment.Type === "Outro"
            ? t("skipCredits")
            : activeSegment.Type === "Recap"
              ? t("skipRecap")
              : t("skipIntro")}
        </button>
      )}

      {/* Up next — near the end, with a known successor (queue or episode). */}
      {ready &&
        nextId &&
        duration > 0 &&
        time > duration - 40 &&
        !activeSegment && (
          <button
            type="button"
            onClick={goToNext}
            className="animate-jn-fade absolute right-10 bottom-28 z-40 flex max-w-[340px] items-center gap-2.5 rounded-lg border border-white/25 bg-black/75 px-5 py-3 text-left text-white backdrop-blur-sm transition hover:bg-black/90"
          >
            <SkipForward className="size-5 flex-none" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-para uppercase">
                {nextEp ? t("nextEpisode") : t("next")}
              </span>
              {nextEp && (
                <span className="block truncate text-[13.5px] font-bold">
                  S{nextEp.ParentIndexNumber}·E{nextEp.IndexNumber} —{" "}
                  {nextEp.Name}
                </span>
              )}
            </span>
          </button>
        )}

      {/* Playback stats ("stats for nerds"). */}
      {showStats && (
        <PlayerStats
          title={t("stats")}
          source={source}
          playMethod={playMethod}
          maxBitrate={bitrate}
          onClose={() => setShowStats(false)}
        />
      )}

      {showHelp && (
        <ShortcutsHelp
          title={t("shortcuts")}
          onClose={() => setShowHelp(false)}
        />
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

          {(prevId || nextId || queueNav.index >= 0) && (
            <div className="ml-auto flex items-center gap-3">
              {queueNav.index >= 0 && (
                <div className="hidden text-right sm:block">
                  {queueTitle && (
                    <div className="max-w-[220px] truncate text-[12px] font-semibold text-bright">
                      {queueTitle}
                    </div>
                  )}
                  <div className="text-[11px] text-para tabular-nums">
                    {queueNav.index + 1} / {queueIds.length}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrev}
                  disabled={!prevId}
                  aria-label={t("previous")}
                  title={
                    prevEp
                      ? `${t("previous")} · S${prevEp.ParentIndexNumber}·E${prevEp.IndexNumber}`
                      : t("previous")
                  }
                  className="flex size-11 items-center justify-center rounded-[10px] bg-white/[0.12] text-white transition-colors hover:bg-white/25 disabled:opacity-35 disabled:hover:bg-white/[0.12]"
                >
                  <SkipBack className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={!nextId}
                  aria-label={t("next")}
                  title={
                    nextEp
                      ? `${t("next")} · S${nextEp.ParentIndexNumber}·E${nextEp.IndexNumber}`
                      : t("next")
                  }
                  className="flex size-11 items-center justify-center rounded-[10px] bg-white/[0.12] text-white transition-colors hover:bg-white/25 disabled:opacity-35 disabled:hover:bg-white/[0.12]"
                >
                  <SkipForward className="size-5" />
                </button>
              </div>
            </div>
          )}
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
          <button
            type="button"
            aria-hidden
            onClick={closeMenu}
            className="pointer-events-auto fixed inset-0 z-20 cursor-default"
          />
        )}
        {menu !== "none" && (
          <div
            className={cn(
              "animate-jn-pop pointer-events-auto absolute right-10 bottom-32 z-30 max-h-[62vh] overflow-y-auto rounded-2xl border border-border-strong bg-bg/95 p-3 shadow-2xl",
              menu === "tracks" ? "w-[360px]" : "w-[308px]",
            )}
          >
            {menu === "tracks" && (
              <TrackMenu
                subLabel={t("subtitles")}
                audioLabel={t("audio")}
                offLabel={t("off")}
                searchPlaceholder={t("searchLanguage")}
                noMatchesLabel={t("noMatches")}
                subs={subStreams.map((s) => ({
                  index: s.Index ?? -1,
                  label: s.DisplayTitle ?? s.Language ?? "",
                  external: s.IsExternal ?? false,
                  text: s.IsTextSubtitleStream ?? true,
                }))}
                audios={audioStreams.map((s) => ({
                  index: s.Index ?? -1,
                  label: s.DisplayTitle ?? s.Language ?? "",
                  codec: s.Codec ?? undefined,
                }))}
                subIndex={subIndex}
                secondaryIndex={secondarySubIndex}
                audioIndex={audioIndex}
                onSub={selectSub}
                onSecondary={selectSecondary}
                onAudio={selectAudio}
                itemId={itemId}
                mediaSourceId={source?.Id ?? undefined}
                onSubtitleAdded={reloadCurrent}
                subDelay={subDelay}
                onSubDelay={adjustSubDelay}
                onResetSubDelay={resetSubDelay}
                canDelay={showTrack}
                onDeleteSub={deleteSubtitle}
                deletingSubIndex={
                  deleteSub.isPending
                    ? (deleteSub.variables?.index ?? null)
                    : null
                }
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
                autoplayLabel={t("autoplayNext")}
                autoplayOn={autoplayNext}
                onToggleAutoplay={() =>
                  usePrefs.getState().set("autoplayNext", !autoplayNext)
                }
                statsLabel={t("stats")}
                statsOn={showStats}
                onToggleStats={() => {
                  setShowStats((v) => !v);
                  setMenu("none");
                }}
                fit={fit}
                onFit={setFit}
                boost={boost}
                onBoost={applyBoost}
                normalizeOn={audioNormalize}
                onToggleNormalize={() => applyNormalize(!audioNormalize)}
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
            {menu === "sync" && (
              <SyncPlayPanel
                itemId={itemId}
                getPositionTicks={() => secondsToTicks(currentAbs())}
              />
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
              className="group/scrub relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/45 transition-[width] duration-300 ease-linear"
                style={{ width: `${bufPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
              {/* Chapter markers */}
              {duration > 0 &&
                (item?.Chapters ?? []).map((ch, i) => {
                  const p = clampPct(
                    (ticksToSeconds(ch.StartPositionTicks) / duration) * 100,
                  );
                  return p > 0.5 && p < 99.5 ? (
                    <span
                      key={i}
                      className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
                      style={{ left: `${p}%` }}
                    />
                  ) : null;
                })}
              <div
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${pct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowRemaining((v) => !v)}
              title={t("toggleRemaining")}
              className="w-16 flex-none text-right text-[12.5px] font-semibold text-muted tabular-nums transition-colors hover:text-bright"
            >
              {showRemaining
                ? `-${formatClock(Math.max(0, duration - time))}`
                : formatClock(duration)}
            </button>
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
                  onClick={() => toggleMenu("scenes")}
                >
                  <ScanFace className="size-4" /> {t("sceneInfo")}
                </TextBtn>
              ) : null}
              <TextBtn
                active={menu === "tracks"}
                onClick={() => toggleMenu("tracks")}
              >
                <Captions className="size-4" /> {t("subtitles")}
              </TextBtn>
              <IconBtn
                active={menu === "settings"}
                onClick={() => toggleMenu("settings")}
                label="Settings"
              >
                <Settings className="size-[18px]" />
              </IconBtn>
              <div className="relative">
                <IconBtn
                  active={menu === "sync"}
                  onClick={() => toggleMenu("sync")}
                  label={t("watchParty")}
                >
                  <Users className="size-[18px]" />
                </IconBtn>
                {syncGroupId && (
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-black" />
                )}
              </div>
              <IconBtn
                onClick={() => setShowHelp((v) => !v)}
                label={t("shortcuts")}
                active={showHelp}
              >
                <Keyboard className="size-[18px]" />
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

/** Split a Jellyfin display title ("English - Default - SRT") into a primary
 *  language label and a secondary tag line. */
function splitLabel(label: string): { primary: string; secondary?: string } {
  const parts = label.split(" - ").map((p) => p.trim());
  if (parts.length <= 1) return { primary: label };
  return { primary: parts[0], secondary: parts.slice(1).join(" · ") };
}

function TrackMenu({
  subLabel,
  audioLabel,
  offLabel,
  searchPlaceholder,
  noMatchesLabel,
  subs,
  audios,
  subIndex,
  secondaryIndex,
  audioIndex,
  onSub,
  onSecondary,
  onAudio,
  itemId,
  mediaSourceId,
  onSubtitleAdded,
  subDelay,
  onSubDelay,
  onResetSubDelay,
  canDelay,
  onDeleteSub,
  deletingSubIndex,
}: {
  subLabel: string;
  audioLabel: string;
  offLabel: string;
  searchPlaceholder: string;
  noMatchesLabel: string;
  subs: { index: number; label: string; external?: boolean; text?: boolean }[];
  audios: { index: number; label: string; codec?: string }[];
  subIndex: number;
  secondaryIndex: number;
  audioIndex?: number;
  onSub: (i: number) => void;
  onSecondary: (i: number) => void;
  onAudio: (i: number) => void;
  itemId: string;
  mediaSourceId?: string;
  onSubtitleAdded: () => void;
  subDelay: number;
  onSubDelay: (v: number) => void;
  onResetSubDelay: () => void;
  canDelay: boolean;
  onDeleteSub: (index: number) => void;
  deletingSubIndex: number | null;
}) {
  const t = useTranslations("Player");
  const [pane, setPane] = useState<"subs" | "audio">("subs");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const filteredSubs = q
    ? subs.filter((s) => s.label.toLowerCase().includes(q))
    : subs;
  const showSearch = pane === "subs" && subs.length > 8;

  // Bring the active row into view when a pane opens.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-on="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pane]);

  if (pane === "subs" && adding) {
    return (
      <SubtitleAddPanel
        itemId={itemId}
        mediaSourceId={mediaSourceId}
        onBack={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          onSubtitleAdded();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Segmented Subtitles / Audio switch */}
      <div className="mb-2.5 flex gap-1 rounded-[10px] bg-white/[0.06] p-1">
        {(
          [
            ["subs", subLabel, subs.length],
            ["audio", audioLabel, audios.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPane(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-bold transition-colors",
              pane === key
                ? "bg-white/15 text-text"
                : "text-muted hover:text-bright",
            )}
          >
            {label}
            <span className="text-[11px] opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {showSearch && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            className="h-9 w-full rounded-lg border border-border-strong bg-white/[0.05] pr-3 pl-9 text-[13px] text-text outline-none focus:border-accent"
          />
        </div>
      )}

      {pane === "subs" && subIndex !== -1 && canDelay && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.05] px-2.5 py-1.5">
          <span className="text-[12px] font-semibold text-muted">
            {t("subtitleDelay")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSubDelay(subDelay - 0.5)}
              aria-label="-0.5s"
              className="flex size-7 items-center justify-center rounded-md bg-white/[0.08] text-[15px] leading-none text-white hover:bg-white/[0.16]"
            >
              −
            </button>
            <button
              type="button"
              onClick={onResetSubDelay}
              className="min-w-[54px] rounded-md px-1 py-1 text-center text-[12.5px] font-bold text-bright tabular-nums hover:bg-white/[0.08]"
            >
              {`${subDelay > 0 ? "+" : ""}${subDelay.toFixed(1)}s`}
            </button>
            <button
              type="button"
              onClick={() => onSubDelay(subDelay + 0.5)}
              aria-label="+0.5s"
              className="flex size-7 items-center justify-center rounded-md bg-white/[0.08] text-[15px] leading-none text-white hover:bg-white/[0.16]"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div ref={listRef} className="max-h-[42vh] overflow-y-auto">
        {pane === "subs" ? (
          <>
            <TrackRow
              primary={offLabel}
              on={subIndex === -1}
              onClick={() => onSub(-1)}
            />
            {filteredSubs.map((s) => {
              const { primary, secondary } = splitLabel(s.label);
              return (
                <div key={s.index} className="group/sub relative">
                  <TrackRow
                    primary={primary}
                    secondary={secondary}
                    on={subIndex === s.index}
                    onClick={() => onSub(s.index)}
                  />
                  <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
                    {(s.text ?? true) && subIndex !== s.index && (
                      <button
                        type="button"
                        onClick={() => onSecondary(s.index)}
                        aria-label={t("secondarySubtitle")}
                        title={t("secondarySubtitle")}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md text-[11px] font-black transition-colors",
                          secondaryIndex === s.index
                            ? "bg-accent text-on-accent"
                            : "text-muted opacity-0 group-hover/sub:opacity-100 hover:bg-white/10 hover:text-bright",
                        )}
                      >
                        2
                      </button>
                    )}
                    {s.external && (
                      <button
                        type="button"
                        onClick={() => onDeleteSub(s.index)}
                        disabled={deletingSubIndex === s.index}
                        aria-label={t("deleteSubtitle")}
                        className="flex size-7 items-center justify-center rounded-md text-muted opacity-0 transition-opacity group-hover/sub:opacity-100 hover:bg-danger/20 hover:text-danger-soft disabled:opacity-100"
                      >
                        {deletingSubIndex === s.index ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredSubs.length === 0 && (
              <div className="px-2 py-4 text-center text-[12.5px] text-muted">
                {noMatchesLabel}
              </div>
            )}
            {itemId && mediaSourceId && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-white/10 px-2 py-2.5 pt-3 text-left text-accent transition-colors hover:bg-white/[0.06]"
              >
                <Plus className="size-4 flex-none" />
                <span className="text-[13px] font-semibold">
                  {t("addSubtitle")}
                </span>
              </button>
            )}
          </>
        ) : (
          audios.map((a, i) => {
            const { primary, secondary } = splitLabel(a.label);
            return (
              <TrackRow
                key={a.index}
                primary={primary}
                secondary={secondary}
                meta={a.codec?.toUpperCase()}
                on={audioIndex != null ? audioIndex === a.index : i === 0}
                onClick={() => onAudio(a.index)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TrackRow({
  primary,
  secondary,
  meta,
  on,
  onClick,
}: {
  primary: string;
  secondary?: string;
  meta?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-on={on}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        on ? "bg-accent/15" : "hover:bg-white/[0.06]",
      )}
    >
      <Check
        className={cn(
          "size-4 flex-none text-accent",
          on ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-semibold",
            on ? "text-accent" : "text-text",
          )}
        >
          {primary}
        </span>
        {secondary && (
          <span className="block truncate text-[11px] text-muted">
            {secondary}
          </span>
        )}
      </span>
      {meta && <span className="flex-none text-[11px] text-muted">{meta}</span>}
    </button>
  );
}

function SettingsMenu({
  qualityLabel,
  speedLabel,
  bitrate,
  rate,
  onBitrate,
  onRate,
  autoplayLabel,
  autoplayOn,
  onToggleAutoplay,
  statsLabel,
  statsOn,
  onToggleStats,
  fit,
  onFit,
  boost,
  onBoost,
  normalizeOn,
  onToggleNormalize,
}: {
  qualityLabel: string;
  speedLabel: string;
  bitrate: number;
  rate: number;
  onBitrate: (v: number) => void;
  onRate: (v: number) => void;
  autoplayLabel: string;
  autoplayOn: boolean;
  onToggleAutoplay: () => void;
  statsLabel: string;
  statsOn: boolean;
  onToggleStats: () => void;
  fit: "contain" | "cover" | "fill";
  onFit: (f: "contain" | "cover" | "fill") => void;
  boost: number;
  onBoost: (v: number) => void;
  normalizeOn: boolean;
  onToggleNormalize: () => void;
}) {
  const t = useTranslations("Player");
  const fits: ["contain" | "cover" | "fill", string][] = [
    ["contain", t("aspectFit")],
    ["cover", t("aspectFill")],
    ["fill", t("aspectStretch")],
  ];
  const boosts = [1, 1.5, 2, 3];
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
      <div className="mx-1 my-2 h-px bg-white/10" />
      <MenuHeading>{t("aspectRatio")}</MenuHeading>
      {fits.map(([value, label]) => (
        <MenuRow
          key={value}
          label={label}
          on={fit === value}
          onClick={() => onFit(value)}
        />
      ))}
      <div className="mx-1 my-2 h-px bg-white/10" />
      <MenuHeading>{t("volumeBoost")}</MenuHeading>
      {boosts.map((b) => (
        <MenuRow
          key={b}
          label={b === 1 ? t("off") : `${Math.round(b * 100)}%`}
          on={boost === b}
          onClick={() => onBoost(b)}
        />
      ))}
      <MenuRow
        label={t("normalizeAudio")}
        on={normalizeOn}
        onClick={onToggleNormalize}
      />
      <div className="mx-1 my-2 h-px bg-white/10" />
      <MenuRow
        label={autoplayLabel}
        on={autoplayOn}
        onClick={onToggleAutoplay}
      />
      <MenuRow label={statsLabel} on={statsOn} onClick={onToggleStats} />
    </div>
  );
}

/** "Stats for nerds" overlay — exposes the resolved playback characteristics. */
function PlayerStats({
  title,
  source,
  playMethod,
  maxBitrate,
  onClose,
}: {
  title: string;
  source?: MediaSourceInfo;
  playMethod: string;
  maxBitrate: number;
  onClose: () => void;
}) {
  const video = source?.MediaStreams?.find(
    (s) => String(s.Type) === "Video",
  ) as MediaStream | undefined;
  const audio = source?.MediaStreams?.find(
    (s) => String(s.Type) === "Audio" && s.IsDefault,
  ) as MediaStream | undefined;
  const mbps = (n?: number | null) =>
    n ? `${(n / 1_000_000).toFixed(1)} Mbps` : "—";
  const reasons =
    (source as { TranscodeReasons?: string[] } | undefined)?.TranscodeReasons ??
    [];

  const rows: [string, string][] = [
    ["Play method", playMethod || "—"],
    [
      "Video",
      video
        ? `${video.Codec?.toUpperCase() ?? "?"} · ${video.Width}×${video.Height}${video.VideoRangeType && video.VideoRangeType !== "SDR" ? ` · ${video.VideoRangeType}` : ""}`
        : "—",
    ],
    [
      "Audio",
      audio
        ? `${audio.Codec?.toUpperCase() ?? "?"} · ${audio.Channels ?? "?"} ch${audio.Language ? ` · ${audio.Language}` : ""}`
        : "—",
    ],
    ["Container", source?.Container?.toUpperCase() ?? "—"],
    ["Source bitrate", mbps(source?.Bitrate)],
    ["Cap", maxBitrate >= 100_000_000 ? "Auto" : mbps(maxBitrate)],
  ];

  return (
    <div className="animate-jn-fade pointer-events-auto absolute top-24 right-8 z-40 w-[320px] rounded-xl border border-border-strong bg-black/85 p-4 backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12.5px] font-extrabold tracking-wide text-bright uppercase">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 font-mono text-[11.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-muted">{k}</span>
            <span className="truncate text-right font-semibold text-text">
              {v}
            </span>
          </div>
        ))}
        {reasons.length > 0 && (
          <div className="mt-1 flex justify-between gap-4">
            <span className="text-muted">Reasons</span>
            <span className="text-right font-semibold text-amber-300">
              {reasons.join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-screen cheat sheet of every player keyboard shortcut (toggled by ?). */
function ShortcutsHelp({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations("Player");
  const rows: [string[], string][] = [
    [["Space", "K"], t("sc_playPause")],
    [["←", "→"], t("sc_seek5")],
    [["J", "L"], t("sc_seek10")],
    [["↑", "↓"], t("sc_volume")],
    [["0", "–", "9"], t("sc_jump")],
    [["Home", "End"], t("sc_startEnd")],
    [["F"], t("sc_fullscreen")],
    [["M"], t("sc_mute")],
    [["C"], t("sc_subtitles")],
    [["P", "I"], t("sc_pip")],
    [["<", ">"], t("sc_speed")],
    [["⇧", "N"], t("sc_next")],
    [["⇧", "P"], t("sc_prev")],
    [["?"], t("sc_help")],
  ];

  return (
    <div
      className="animate-jn-fade pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-jn-pop max-h-[85vh] w-[min(640px,92vw)] overflow-y-auto rounded-2xl border border-border-strong bg-black/85 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-extrabold text-bright">
            <Keyboard className="size-5" />
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {rows.map(([keys, label]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-[13px] text-text">{label}</span>
              <span className="flex flex-none items-center gap-1">
                {keys.map((k, i) =>
                  k === "–" ? (
                    <span key={i} className="text-[12px] text-muted">
                      –
                    </span>
                  ) : (
                    <kbd
                      key={i}
                      className="min-w-6 rounded-md border border-border-strong bg-white/[0.08] px-1.5 py-0.5 text-center font-mono text-[11.5px] font-semibold text-bright"
                    >
                      {k}
                    </kbd>
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SUB_LANGS = [
  ["eng", "English"],
  ["tur", "Türkçe"],
  ["spa", "Español"],
  ["fre", "Français"],
  ["ger", "Deutsch"],
  ["ita", "Italiano"],
  ["por", "Português"],
  ["rus", "Русский"],
  ["ara", "العربية"],
  ["jpn", "日本語"],
] as const;

/** In-player subtitle sourcing: search providers (Open Subtitles) or upload. */
function SubtitleAddPanel({
  itemId,
  mediaSourceId,
  onBack,
  onAdded,
}: {
  itemId: string;
  mediaSourceId?: string;
  onBack: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("Player");
  const [lang, setLang] = useState("eng");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const search = useRemoteSubtitleSearch(itemId, lang, searchEnabled);
  const download = useDownloadRemoteSubtitle();
  const upload = useUploadSubtitle();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !mediaSourceId) return;
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const format = file.name.split(".").pop()?.toLowerCase() || "srt";
    upload.mutate(
      { itemId, language: lang, format, data: base64 },
      { onSuccess: onAdded },
    );
    e.target.value = "";
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-text"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-[13.5px] font-bold">{t("addSubtitle")}</span>
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {SUB_LANGS.map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setLang(code);
              setSearchEnabled(false);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
              lang === code
                ? "bg-accent text-on-accent"
                : "bg-white/[0.08] text-bright hover:bg-white/[0.16]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setSearchEnabled(true)}
          disabled={search.isFetching}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-60"
        >
          {search.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {t("searchOnline")}
        </button>
        {mediaSourceId && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-60"
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {t("upload")}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.sub"
          onChange={onFile}
          className="hidden"
        />
      </div>

      <div className="max-h-[38vh] overflow-y-auto">
        {searchEnabled && search.isError && (
          <div className="px-2 py-4 text-center text-[12px] text-danger-soft">
            {t("searchFailed")}
          </div>
        )}
        {searchEnabled &&
          !search.isFetching &&
          (search.data?.length ?? 0) === 0 && (
            <div className="px-2 py-4 text-center text-[12.5px] text-muted">
              {t("noSubtitlesFound")}
            </div>
          )}
        {(search.data ?? []).map((r: RemoteSubtitleInfo) => (
          <div
            key={r.Id}
            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.05]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-text">
                {r.Name}
              </div>
              <div className="truncate text-[10.5px] text-muted">
                {[
                  r.ProviderName,
                  r.Format?.toUpperCase(),
                  r.DownloadCount != null ? `↓${r.DownloadCount}` : null,
                  r.IsHashMatch ? "★ match" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                download.mutate(
                  { itemId, subtitleId: r.Id },
                  { onSuccess: onAdded },
                )
              }
              disabled={download.isPending}
              aria-label={t("download")}
              className="flex size-8 flex-none items-center justify-center rounded-lg bg-white/[0.08] text-white transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
            >
              {download.isPending && download.variables?.subtitleId === r.Id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** SyncPlay (watch party): create / join / leave a group and see who's in it. */
function SyncPlayPanel({
  itemId,
  getPositionTicks,
}: {
  itemId: string;
  getPositionTicks: () => number;
}) {
  const t = useTranslations("Player");
  const { groupId, groupName, join, leave } = useSyncPlay();
  const groups = useSyncPlayGroups(true);
  const create = useSyncPlayNew();
  const joinM = useSyncPlayJoin();
  const leaveM = useSyncPlayLeave();
  const [name, setName] = useState("");

  const list = groups.data ?? [];
  const myGroup = list.find((g) => g.GroupId === groupId);
  const others = list.filter((g) => g.GroupId !== groupId);

  function onCreate() {
    create.mutate(name.trim() || "Watch Party", {
      onSuccess: (g) => {
        join(g.GroupId, g.GroupName);
        syncPlaySetQueue(itemId, getPositionTicks());
        setName("");
      },
    });
  }
  function onJoin(g: SyncPlayGroup) {
    joinM.mutate(g.GroupId, { onSuccess: () => join(g.GroupId, g.GroupName) });
  }
  function onLeave() {
    leaveM.mutate(undefined, { onSuccess: () => leave() });
  }

  return (
    <div className="flex flex-col">
      <MenuHeading>{t("watchParty")}</MenuHeading>
      {groupId ? (
        <div>
          <div className="mb-2 rounded-lg bg-white/[0.05] p-3">
            <div className="mb-1 flex items-center gap-2">
              <Users className="size-4 flex-none text-accent" />
              <span className="truncate text-[13.5px] font-bold">
                {myGroup?.GroupName ?? groupName}
              </span>
              {myGroup && (
                <span className="ml-auto flex-none text-[11px] text-muted">
                  {myGroup.State}
                </span>
              )}
            </div>
            <div className="text-[12px] text-para">
              {(myGroup?.Participants ?? []).join(", ") || "…"}
            </div>
          </div>
          <button
            type="button"
            onClick={onLeave}
            disabled={leaveM.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-[12.5px] font-bold text-danger-soft transition-colors hover:bg-danger/10 disabled:opacity-60"
          >
            {leaveM.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("leaveParty")}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-dim">
            {t("syncNote")}
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("partyName")}
              className="h-9 flex-1 rounded-lg border border-border-strong bg-white/[0.05] px-3 text-[13px] text-text outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onCreate}
              disabled={create.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {t("create")}
            </button>
          </div>
          <div className="max-h-[32vh] overflow-y-auto">
            {others.length === 0 && (
              <div className="px-2 py-4 text-center text-[12.5px] text-muted">
                {t("noParties")}
              </div>
            )}
            {others.map((g) => (
              <button
                key={g.GroupId}
                type="button"
                onClick={() => onJoin(g)}
                disabled={joinM.isPending}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
              >
                <Users className="size-4 flex-none text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {g.GroupName}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {g.Participants.join(", ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
