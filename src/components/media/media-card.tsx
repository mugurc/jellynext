"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Play, Star } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  gradientFallback,
  posterUrl,
  resumePercent,
  thumbUrl,
} from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";
import { CardActions } from "./card-actions";

export type CardVariant = "poster" | "wide";

interface MediaCardProps {
  item: BaseItemDto;
  variant?: CardVariant;
  showProgress?: boolean;
  showRating?: boolean;
  /** Favorite / watched toggles and the overflow menu. */
  showActions?: boolean;
  className?: string;
}

function metaLine(item: BaseItemDto): string {
  if (item.Type === "Episode") {
    const s = item.ParentIndexNumber;
    const e = item.IndexNumber;
    const code = s != null && e != null ? `S${s}·E${e}` : "";
    return [code, item.Name].filter(Boolean).join(" · ");
  }
  // A season's caption carries the series name, so the line under it is where
  // the season itself belongs — otherwise the tile reads as its own show.
  if (item.Type === "Season") return item.Name ?? "";
  const year = item.ProductionYear ? String(item.ProductionYear) : "";
  const genre = item.Genres?.[0] ?? "";
  return [year, genre].filter(Boolean).join(" · ");
}

/**
 * A poster (2:3) or wide (16:9) media tile; hover reveals a play button.
 * Fills whatever box it is given — grids size it by column, and the carousel
 * puts a fixed width on its own children.
 */
export function MediaCard({
  item,
  variant = "poster",
  showProgress = false,
  showRating = true,
  showActions = true,
  className,
}: MediaCardProps) {
  const router = useRouter();
  const t = useTranslations("Card");
  const wide = variant === "wide";
  const [artLoaded, setArtLoaded] = useState(false);

  const detailHref = `/item/${item.Id}`;
  const img = wide
    ? thumbUrl(item, { maxWidth: 500 })
    : posterUrl(item, { maxWidth: 360 });
  const rating = item.CommunityRating?.toFixed(1);
  const progress = showProgress ? resumePercent(item) : 0;
  // Episodes and seasons are named for their place in a show ("Season 2"), not
  // for themselves — the show is what the viewer is actually looking for.
  const displayTitle =
    item.Type === "Episode" || item.Type === "Season"
      ? (item.SeriesName ?? item.Name)
      : item.Name;
  // Only directly-playable types get the quick-play shortcut on hover.
  const playable =
    item.Type === "Movie" ||
    item.Type === "Episode" ||
    item.Type === "Video" ||
    item.Type === "MusicVideo";

  function play(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/watch/${item.Id}`);
  }

  return (
    <Link
      href={detailHref}
      className={cn(
        "group relative block w-full transition-transform duration-200 ease-out hover:-translate-y-0.5",
        className,
      )}
    >
      {/* The placeholder gradient is this element's own background rather than a
          child: a background is clipped by the element's own border-radius
          exactly, whereas a child is clipped by the ancestor's overflow, which
          antialiases and lets whatever sits beneath bleed through the corners.
          The children on top carry the same radius for the same reason. */}
      <div
        className={cn(
          "relative mb-[9px] overflow-hidden rounded-token bg-card transition-[box-shadow] duration-200 group-hover:ring-2 group-hover:ring-white/15",
          wide ? "aspect-video" : "aspect-[2/3]",
        )}
        style={{ backgroundImage: gradientFallback(item.Id) }}
      >
        {/* The one place that does not use <Art>. Artwork and its wash share one
            wrapper, and only the wrapper fades.
            As separate children the fading one gets its own compositing layer,
            and the two rounded edges then disagree by a fraction of a pixel —
            which showed up as unwashed artwork bleeding at the bottom corners.
            One layer, one clip: the corners cannot disagree with themselves. */}
        <div
          className={cn(
            "jn-img-fade absolute inset-0",
            // With no artwork there is nothing to wait for, so the wash should
            // not sit here invisible waiting for a load event that never comes.
            artLoaded || !img ? "opacity-100" : "opacity-0",
          )}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={(node) => {
                if (node?.complete) setArtLoaded(true);
              }}
              src={img}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setArtLoaded(true)}
              className="absolute inset-0 size-full object-cover object-center"
            />
          )}
          {/* Bottom-only wash, per the design reference: it grounds the poster
              without washing out the artwork the way a full-height one does. */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[58%] to-scrim/85" />
        </div>

        {showRating && rating && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-[5px] bg-scrim/60 px-1.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <Star className="size-3 fill-current text-accent" />
            {rating}
          </span>
        )}

        {/* Every card darkens on hover, playable or not — otherwise movies and
            series sitting side by side in a row behave differently. Kept off
            touch devices, where a permanently dimmed grid would look broken. */}
        <div className="absolute inset-0 bg-scrim/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100" />

        {playable && (
          <div className="jn-hover-reveal pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200">
            <button
              type="button"
              onClick={play}
              aria-label={t("playItem", { title: displayTitle ?? "" })}
              className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-white/95 text-on-accent shadow-lg transition-transform duration-200 hover:scale-105"
            >
              <Play className="size-5 translate-x-px fill-current" />
            </button>
          </div>
        )}

        {showActions && <CardActions item={item} playable={playable} />}

        {showProgress && progress > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Caption sits below the artwork, as in the design reference. The colour
          is explicit because the card is an <a>, and bare anchors are accent. */}
      <div className="truncate text-sm leading-[1.25] font-bold text-text">
        {displayTitle}
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-muted">
        {metaLine(item)}
      </div>
    </Link>
  );
}
