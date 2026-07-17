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

  return (
    <Carousel title={title} seeAllHref={seeAllHref}>
      {items.map((item) => (
        <MediaCard
          key={item.Id}
          item={item}
          variant={variant}
          showProgress={showProgress}
        />
      ))}
    </Carousel>
  );
}
