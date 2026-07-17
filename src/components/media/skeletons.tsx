import { cn } from "@/lib/utils";
import type { CardVariant } from "./media-card";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-card/70", className)} />
  );
}

export function CardSkeleton({
  variant = "poster",
}: {
  variant?: CardVariant;
}) {
  const wide = variant === "wide";
  return (
    <div className={cn("flex-none", wide ? "w-[326px]" : "w-[184px]")}>
      <Skeleton
        className={cn(
          "w-full rounded-token",
          wide ? "aspect-video" : "aspect-[2/3]",
        )}
      />
    </div>
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
      <div className="flex gap-4 overflow-hidden pb-1.5">
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
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-token" />
      ))}
    </div>
  );
}
