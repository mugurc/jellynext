import { cn } from "@/lib/utils";
import type { CardVariant } from "./media-card";

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
      <CardSkeletonBody wide={wide} />
    </div>
  );
}

/** Artwork block plus the two caption lines, matching MediaCard's geometry. */
function CardSkeletonBody({ wide }: { wide?: boolean }) {
  return (
    <>
      <Skeleton
        className={cn(
          "mb-[9px] w-full rounded-token",
          wide ? "aspect-video" : "aspect-[2/3]",
        )}
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
      <Skeleton className="mb-4 h-6 w-48" />
      {/* Same gap and gutter as the live carousel, so nothing shifts on swap. */}
      <div className="flex gap-5 overflow-hidden pt-1.5 pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} variant={variant} />
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <CardSkeletonBody />
        </div>
      ))}
    </div>
  );
}
