import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Carousel } from "./carousel";
import { MediaCard, type CardVariant } from "./media-card";
import { CarouselSkeleton } from "./skeletons";

interface MediaRowProps {
  title: string;
  items?: BaseItemDto[];
  isLoading?: boolean;
  variant?: CardVariant;
  showProgress?: boolean;
  seeAllHref?: string;
}

/** A titled carousel of media cards; renders a skeleton while loading and
 *  nothing at all when the row is empty. */
export function MediaRow({
  title,
  items,
  isLoading,
  variant = "poster",
  showProgress,
  seeAllHref,
}: MediaRowProps) {
  if (isLoading) return <CarouselSkeleton variant={variant} />;
  if (!items?.length) return null;

  // Cards size themselves to their container; in a scroller that container is
  // the card itself, so the fixed track width belongs here rather than in the
  // card, where it used to fight the grid layouts.
  const width = variant === "wide" ? "w-[326px]" : "w-[184px]";

  return (
    <Carousel title={title} seeAllHref={seeAllHref}>
      {items.map((item) => (
        <MediaCard
          key={item.Id}
          item={item}
          variant={variant}
          showProgress={showProgress}
          className={`${width} flex-none`}
        />
      ))}
    </Carousel>
  );
}
