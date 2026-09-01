import { cn } from "@/lib/utils";
import type { CardVariant } from "./media-card";

/** Aspect ratios an artwork placeholder can take. */
type SkeletonShape = CardVariant | "square";

const SHAPE: Record<SkeletonShape, string> = {
  poster: "aspect-[2/3]",
  wide: "aspect-video",
  square: "aspect-square",
};

/** The grid geometry most listing pages use. Callers on a different grid pass
 *  their own — column width and gap have to match or the layout jumps. */
export const GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("jn-skeleton rounded-lg bg-card/70", className)} />;
}

export function CardSkeleton({
  variant = "poster",
}: {
  variant?: CardVariant;
}) {
  const wide = variant === "wide";
  return (
    <div className={cn("flex-none", wide ? "w-[326px]" : "w-[184px]")}>
      <CardSkeletonBody variant={variant} />
    </div>
  );
}

/** Artwork block plus the two caption lines, matching MediaCard's geometry. */
function CardSkeletonBody({ variant = "poster" }: { variant?: SkeletonShape }) {
  return (
    <>
      <Skeleton
        className={cn("mb-[9px] w-full rounded-token", SHAPE[variant])}
      />
      <Skeleton className="h-[13px] w-3/4 rounded" />
      <Skeleton className="mt-1 h-[11px] w-1/2 rounded" />
    </>
  );
}

export function CarouselSkeleton({
  variant = "poster",
  count = 6,
}: {
  variant?: CardVariant;
  count?: number;
}) {
  return (
    <div className="mb-9">
      {/* h-7 rather than h-6: the real heading is text-xl, a 28px line box. */}
      <Skeleton className="mb-4 h-7 w-48" />
      {/* Same gap and gutter as the live carousel, so nothing shifts on swap. */}
      <div className="flex gap-5 overflow-hidden pt-1.5 pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} variant={variant} />
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({
  count = 18,
  variant = "poster",
  className = GRID_CLASS,
}: {
  count?: number;
  variant?: SkeletonShape;
  /** The real content's grid classes, so columns and gaps line up. */
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <CardSkeletonBody variant={variant} />
        </div>
      ))}
    </div>
  );
}

/**
 * A vertical list of rows: an optional leading marker and artwork block, then
 * text lines.
 *
 * Most of this app's non-grid content is rows — episodes, tracks, collection
 * members, recordings, channels. A poster grid standing in for one of those
 * does not just differ in size, it changes shape entirely when the real content
 * lands. Pass the row's own padding and gap so the two heights agree.
 */
export function ListSkeleton({
  count = 6,
  leading,
  thumb,
  lines = 2,
  rowClassName = "flex items-center gap-4 py-3",
  className = "flex flex-col",
}: {
  count?: number;
  /** A small block before the artwork, e.g. "size-6" for an episode number. */
  leading?: string;
  /** Artwork geometry, e.g. "aspect-video w-[120px] rounded-lg". */
  thumb?: string;
  lines?: number;
  rowClassName?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={rowClassName}>
          {leading && <Skeleton className={cn("flex-none rounded", leading)} />}
          {thumb && <Skeleton className={cn("flex-none", thumb)} />}
          <div className="min-w-0 flex-1">
            <Skeleton className="h-[15px] w-1/3 rounded" />
            {Array.from({ length: Math.max(0, lines - 1) }).map((_, j) => (
              <Skeleton
                key={j}
                className={cn(
                  "mt-1.5 h-[13px] rounded",
                  j === 0 ? "w-4/5" : "w-3/5",
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
