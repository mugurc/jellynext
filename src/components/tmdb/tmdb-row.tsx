"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Carousel } from "@/components/media/carousel";
import { CarouselSkeleton } from "@/components/media/skeletons";
import {
  tmdbImage,
  tmdbTitle,
  tmdbType,
  tmdbYear,
  type TmdbItem,
} from "@/lib/tmdb/queries";

/** A titled carousel of TMDb discovery cards (external, info-only). */
export function TmdbRow({
  title,
  items,
  isLoading,
}: {
  title: string;
  items?: TmdbItem[];
  isLoading?: boolean;
}) {
  if (isLoading) return <CarouselSkeleton variant="poster" />;
  if (!items?.length) return null;
  return (
    <Carousel title={title}>
      {items.map((item) => (
        <TmdbCard key={`${tmdbType(item)}-${item.id}`} item={item} />
      ))}
    </Carousel>
  );
}

function TmdbCard({ item }: { item: TmdbItem }) {
  const img = tmdbImage(item.poster_path, "w342");
  const year = tmdbYear(item);
  const rating = item.vote_average;
  return (
    <Link
      href={`/discover/${tmdbType(item)}/${item.id}`}
      className="group w-[176px] flex-none transition-transform duration-200 ease-out hover:-translate-y-0.5"
    >
      <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded-xl bg-card">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={tmdbTitle(item)}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-card text-dim">
            {tmdbTitle(item)}
          </div>
        )}
        {rating ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
            <Star className="size-3 fill-current" />
            {rating.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="truncate text-[13.5px] font-semibold text-bright group-hover:text-accent">
        {tmdbTitle(item)}
      </div>
      {year && <div className="text-[12px] text-muted">{year}</div>}
    </Link>
  );
}
