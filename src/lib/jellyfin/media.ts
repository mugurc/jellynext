import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { itemImageUrl } from "./browser";

export const TICKS_PER_SECOND = 10_000_000;

export function ticksToSeconds(ticks?: number | null): number {
  return ticks ? ticks / TICKS_PER_SECOND : 0;
}

/** "2h 14m" / "48m" from runtime ticks. */
export function formatRuntime(ticks?: number | null): string {
  const total = Math.round(ticksToSeconds(ticks) / 60);
  if (!total) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "1:23:45" / "4:05" from seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 0–100 resume progress for an item, if any. */
export function resumePercent(item: BaseItemDto): number {
  const played = item.UserData?.PlayedPercentage;
  if (typeof played === "number") return played;
  const pos = item.UserData?.PlaybackPositionTicks;
  const total = item.RunTimeTicks;
  if (pos && total) return (pos / total) * 100;
  return 0;
}

interface SizeOpts {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/** Best poster/primary artwork for an item (falls back to series/album parent). */
export function posterUrl(
  item: BaseItemDto,
  opts: SizeOpts = {},
): string | null {
  if (item.ImageTags?.Primary) {
    return itemImageUrl(item.Id!, "Primary", {
      tag: item.ImageTags.Primary,
      ...opts,
    });
  }
  if (item.SeriesId && item.SeriesPrimaryImageTag) {
    return itemImageUrl(item.SeriesId, "Primary", {
      tag: item.SeriesPrimaryImageTag,
      ...opts,
    });
  }
  if (item.AlbumId && item.AlbumPrimaryImageTag) {
    return itemImageUrl(item.AlbumId, "Primary", {
      tag: item.AlbumPrimaryImageTag,
      ...opts,
    });
  }
  return null;
}

/** Best wide/landscape artwork (Thumb → Backdrop → parent), for 16:9 cards. */
export function thumbUrl(
  item: BaseItemDto,
  opts: SizeOpts = {},
): string | null {
  if (item.ImageTags?.Thumb) {
    return itemImageUrl(item.Id!, "Thumb", {
      tag: item.ImageTags.Thumb,
      ...opts,
    });
  }
  if (item.BackdropImageTags?.length) {
    return itemImageUrl(item.Id!, "Backdrop", {
      tag: item.BackdropImageTags[0],
      ...opts,
    });
  }
  if (item.ParentThumbItemId && item.ParentThumbImageTag) {
    return itemImageUrl(item.ParentThumbItemId, "Thumb", {
      tag: item.ParentThumbImageTag,
      ...opts,
    });
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
    return itemImageUrl(item.ParentBackdropItemId, "Backdrop", {
      tag: item.ParentBackdropImageTags[0],
      ...opts,
    });
  }
  return posterUrl(item, opts);
}

/** Full-bleed backdrop for hero/detail sections. */
export function backdropUrl(
  item: BaseItemDto,
  opts: SizeOpts = {},
): string | null {
  if (item.BackdropImageTags?.length) {
    return itemImageUrl(item.Id!, "Backdrop", {
      tag: item.BackdropImageTags[0],
      ...opts,
    });
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
    return itemImageUrl(item.ParentBackdropItemId, "Backdrop", {
      tag: item.ParentBackdropImageTags[0],
      ...opts,
    });
  }
  return thumbUrl(item, opts);
}

/** Deterministic hue (0–359) from an item id, for gradient fallbacks. */
export function hueFromId(id?: string | null): number {
  if (!id) return 210;
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

/** oklch gradient fallback shown while artwork loads or when missing. */
export function gradientFallback(id?: string | null): string {
  const h = hueFromId(id);
  return `linear-gradient(150deg, oklch(0.5 0.15 ${h}), oklch(0.28 0.11 ${(h + 50) % 360}))`;
}
