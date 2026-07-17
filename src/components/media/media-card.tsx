"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Play, Plus, Star } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  gradientFallback,
  posterUrl,
  resumePercent,
  thumbUrl,
} from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

export type CardVariant = "poster" | "wide";

interface MediaCardProps {
  item: BaseItemDto;
  variant?: CardVariant;
  showProgress?: boolean;
  showRating?: boolean;
  className?: string;
}

function metaLine(item: BaseItemDto): string {
  if (item.Type === "Episode") {
    const s = item.ParentIndexNumber;
    const e = item.IndexNumber;
    const code = s != null && e != null ? `S${s}·E${e}` : "";
    return [code, item.Name].filter(Boolean).join(" · ");
  }
  const year = item.ProductionYear ? String(item.ProductionYear) : "";
  const genre = item.Genres?.[0] ?? "";
  return [year, genre].filter(Boolean).join(" · ");
}

/** A poster (2:3) or wide (16:9) media tile with a hover info overlay. */
export function MediaCard({
  item,
  variant = "poster",
  showProgress = false,
  showRating = true,
  className,
}: MediaCardProps) {
  const t = useTranslations("Common");
  const router = useRouter();
  const wide = variant === "wide";

  const detailHref = `/item/${item.Id}`;
  const img = wide
    ? thumbUrl(item, { maxWidth: 500 })
    : posterUrl(item, { maxWidth: 360 });
  const rating = item.CommunityRating?.toFixed(1);
  const progress = showProgress ? resumePercent(item) : 0;
  const displayTitle =
    item.Type === "Episode" ? (item.SeriesName ?? item.Name) : item.Name;

  function play(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/watch/${item.Id}`);
  }

  return (
    <Link
      href={detailHref}
      className={cn(
        "group relative block flex-none",
        wide ? "w-[326px]" : "w-[184px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-token bg-card shadow-[0_6px_20px_rgba(0,0,0,0.4)]",
          wide ? "aspect-video" : "aspect-[2/3]",
        )}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: img
              ? `url("${img}"), ${gradientFallback(item.Id)}`
              : gradientFallback(item.Id),
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-scrim/90" />

        {showRating && rating && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-[5px] bg-scrim/60 px-1.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <Star className="size-3 fill-current text-accent" />
            {rating}
          </span>
        )}

        {showProgress && progress > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}

        {/* Resting caption */}
        <div className="absolute inset-x-3 bottom-3">
          <div className="truncate text-sm font-bold">{displayTitle}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted">
            {metaLine(item)}
          </div>
        </div>

        {/* Hover overlay (no scale) */}
        <div className="absolute inset-0 flex flex-col justify-end gap-2.5 bg-gradient-to-b from-transparent to-scrim/95 p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="text-[15px] leading-tight font-bold">
            {displayTitle}
          </div>
          {item.Overview && (
            <p className="line-clamp-3 text-[11.5px] leading-snug text-para">
              {item.Overview}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={play}
              className="flex items-center gap-1.5 rounded-[7px] bg-white px-3 py-2 text-[12.5px] font-extrabold text-on-accent"
            >
              <Play className="size-3.5 fill-current" /> {t("play")}
            </button>
            <span className="flex size-9 items-center justify-center rounded-[7px] border-[1.5px] border-white/45 text-white transition-colors group-hover:border-white">
              <Plus className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
