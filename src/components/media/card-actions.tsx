"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  Heart,
  ListPlus,
  MoreVertical,
  Play,
  RotateCcw,
  Tv,
} from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Portal } from "@/components/common/portal";
import { MENU_SURFACE, MenuItem } from "@/components/common/menu";
import { AddToListModal } from "@/components/detail/add-to-list-modal";
import {
  useResetProgress,
  useToggleFavorite,
  useTogglePlayed,
} from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

/** Matches the `w-56` on the menu surface; needed before it can be measured. */
const MENU_WIDTH = 224;
const GAP = 6;
const EDGE = 8;
/** One control's slot in the action row: `size-6` (24px) plus the `gap-1` (4px). */
const SLOT = 28;

/** Swallows the click so the surrounding card link does not navigate. */
function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Keeps the menu on screen for cards sitting near either viewport edge. */
function clampLeft(left: number, width: number) {
  return Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
}

function IconButton({
  label,
  active,
  pinned,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  /** Stays visible without hover — how watched/favorite state reads at a glance. */
  pinned?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // 24px rather than 28px: three of these plus the rating badge have to
        // share the top edge of a 184px poster.
        "flex size-6 shrink-0 items-center justify-center rounded-full backdrop-blur-sm transition-[opacity,background-color,transform] duration-200 hover:scale-105",
        active
          ? "bg-accent text-on-accent"
          : "bg-scrim/70 text-white hover:bg-scrim/90",
        !pinned && "jn-hover-reveal",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Quick favorite / watched toggles plus an overflow menu, overlaid on a media
 * card. The menu renders through a portal because cards sit inside horizontally
 * scrolling carousels that would otherwise clip it.
 */
export function CardActions({
  item,
  playable,
}: {
  item: BaseItemDto;
  playable: boolean;
}) {
  const t = useTranslations("Card");
  const router = useRouter();
  const favorite = useToggleFavorite();
  const played = useTogglePlayed();
  const resetProgress = useResetProgress();

  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const close = useCallback(() => {
    setAnchor(null);
    setPos(null);
  }, []);

  // A callback ref rather than a layout effect: the menu goes through a portal
  // that mounts a tick late, so an effect keyed on `anchor` would measure a node
  // that is not in the DOM yet and would never run again once it appeared. This
  // fires the moment the node attaches, still before paint.
  const measure = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !anchor) return;
      const menu = node.getBoundingClientRect();
      const below = anchor.bottom + GAP;
      setPos({
        left: clampLeft(anchor.right - menu.width, menu.width),
        top:
          below + menu.height > window.innerHeight - EDGE
            ? Math.max(EDGE, anchor.top - menu.height - GAP)
            : below,
      });
    },
    [anchor],
  );

  useEffect(() => {
    if (!anchor) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    // Both the page and the carousel scroll; a fixed menu would drift away from
    // the card it belongs to, so close instead of chasing it.
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [anchor, close]);

  const id = item.Id;
  if (!id) return null;

  const isFavorite = item.UserData?.IsFavorite ?? false;
  const isPlayed = item.UserData?.Played ?? false;
  const resumable = (item.UserData?.PlaybackPositionTicks ?? 0) > 0;

  function run(action: () => void) {
    return (e: React.MouseEvent) => {
      stop(e);
      action();
    };
  }

  const toggleFavorite = () => favorite.mutate({ id, favorite: !isFavorite });
  const togglePlayed = () => played.mutate({ id, played: !isPlayed });

  return (
    // The menu and the modal render through portals, but their clicks still
    // bubble up this component tree into the card's link and would navigate.
    // `display: contents` lets one wrapper catch them without adding a box.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <div
        className="jn-card-actions absolute top-2.5 left-2.5 z-10 flex items-center gap-1"
        // The favorite toggle leads the row, so when it is hidden the row has to
        // slide over by its slot for the watched badge to reach the edge.
        style={
          {
            "--jn-idle-shift": !isFavorite && isPlayed ? `${-SLOT}px` : "0px",
          } as React.CSSProperties
        }
      >
        <IconButton
          label={isFavorite ? t("removeFavorite") : t("addFavorite")}
          active={isFavorite}
          pinned={isFavorite}
          onClick={run(toggleFavorite)}
        >
          <Heart className={cn("size-3.5", isFavorite && "fill-current")} />
        </IconButton>

        <IconButton
          label={isPlayed ? t("markUnwatched") : t("markWatched")}
          active={isPlayed}
          pinned={isPlayed}
          onClick={run(togglePlayed)}
        >
          <Check className="size-3.5" />
        </IconButton>

        <IconButton
          label={t("more")}
          onClick={(e) => {
            stop(e);
            const rect = e.currentTarget.getBoundingClientRect();
            setAnchor((a) => (a ? null : rect));
          }}
        >
          <MoreVertical className="size-3.5" />
        </IconButton>
      </div>

      {anchor && (
        <Portal>
          <button
            type="button"
            aria-hidden
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            ref={measure}
            role="menu"
            style={{
              // Clamped up front too, so the one frame before measuring is
              // already on screen rather than hanging off the left edge.
              top: pos?.top ?? anchor.bottom + GAP,
              left:
                pos?.left ?? clampLeft(anchor.right - MENU_WIDTH, MENU_WIDTH),
            }}
            className={cn("fixed z-50 w-56", MENU_SURFACE)}
          >
            {playable && (
              <MenuItem
                icon={<Play className="size-4" />}
                label={resumable ? t("resume") : t("play")}
                onClick={() => {
                  close();
                  router.push(`/watch/${id}`);
                }}
              />
            )}
            {resumable && (
              <MenuItem
                icon={<RotateCcw className="size-4" />}
                label={t("resetProgress")}
                onClick={() => {
                  close();
                  resetProgress.mutate({ id, userData: item.UserData });
                }}
              />
            )}
            <MenuItem
              icon={<Check className="size-4" />}
              label={isPlayed ? t("markUnwatched") : t("markWatched")}
              onClick={() => {
                close();
                togglePlayed();
              }}
            />
            <MenuItem
              icon={
                <Heart className={cn("size-4", isFavorite && "fill-current")} />
              }
              label={isFavorite ? t("removeFavorite") : t("addFavorite")}
              onClick={() => {
                close();
                toggleFavorite();
              }}
            />
            <MenuItem
              icon={<ListPlus className="size-4" />}
              label={t("addToList")}
              onClick={() => {
                close();
                setListOpen(true);
              }}
            />
            {(item.Type === "Episode" || item.Type === "Season") &&
              item.SeriesId && (
                <MenuItem
                  icon={<Tv className="size-4" />}
                  label={t("goToSeries")}
                  onClick={() => {
                    close();
                    router.push(`/item/${item.SeriesId}`);
                  }}
                />
              )}
          </div>
        </Portal>
      )}

      {listOpen && (
        <AddToListModal item={item} onClose={() => setListOpen(false)} />
      )}
    </div>
  );
}
