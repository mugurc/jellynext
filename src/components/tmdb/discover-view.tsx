"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Info, Loader2, Star } from "lucide-react";
import { TmdbRow } from "./tmdb-row";
import { FadeImg } from "@/components/common/fade-img";
import { Skeleton } from "@/components/media/skeletons";
import {
  tmdbImage,
  tmdbLogo,
  tmdbTitle,
  tmdbType,
  tmdbYear,
  useTmdbImages,
  useTmdbNowPlaying,
  useTmdbPopularMovies,
  useTmdbPopularTv,
  useTmdbTopRatedMovies,
  useTmdbTrending,
  useTmdbTrendingTv,
  useTmdbUpcoming,
  type TmdbItem,
} from "@/lib/tmdb/queries";

/** Worldwide discovery — TMDb trending/new/popular, info-only (no playback). */
export function DiscoverView() {
  const t = useTranslations("Discover");
  const tc = useTranslations("Common");
  const trending = useTmdbTrending();
  const nowPlaying = useTmdbNowPlaying();
  const popularMovies = useTmdbPopularMovies();
  const popularTv = useTmdbPopularTv();
  const trendingTv = useTmdbTrendingTv();
  const topRated = useTmdbTopRatedMovies();
  const upcoming = useTmdbUpcoming();

  // Feature the top backdrop-having trending title in a billboard.
  const hero = (trending.data ?? []).find((i) => i.backdrop_path);
  const unavailable = trending.isError;

  if (unavailable) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-10 text-center">
        <Info className="size-8 text-dim" />
        <h1 className="text-xl font-bold">{t("unavailableTitle")}</h1>
        <p className="max-w-[440px] text-[14px] text-muted">
          {t("unavailableHint")}
        </p>
        <button
          type="button"
          onClick={() => trending.refetch()}
          disabled={trending.isFetching}
          className="mt-2 flex items-center gap-2 rounded-lg border-[1.5px] border-bright/40 bg-white/[0.08] px-5 py-2.5 text-[13px] font-bold text-white transition hover:border-white disabled:opacity-50"
        >
          {trending.isFetching && <Loader2 className="size-4 animate-spin" />}
          {tc("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-jn-fade">
      {trending.isLoading ? (
        // Matches DiscoverHero's min-h-[440px]; without it the rows below
        // jumped ~440px on every visit once the data landed.
        <Skeleton className="h-[440px] rounded-none" />
      ) : hero ? (
        <DiscoverHero item={hero} discoverLabel={t("title")} />
      ) : (
        <div className="px-10 pt-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            {t("title")}
          </h1>
        </div>
      )}

      <div className="relative -mt-6 px-10 pb-16">
        <TmdbRow
          title={t("trending")}
          items={trending.data}
          isLoading={trending.isLoading}
        />
        <TmdbRow
          title={t("inTheaters")}
          items={nowPlaying.data}
          isLoading={nowPlaying.isLoading}
        />
        <TmdbRow
          title={t("popularMovies")}
          items={popularMovies.data}
          isLoading={popularMovies.isLoading}
        />
        <TmdbRow
          title={t("trendingShows")}
          items={trendingTv.data}
          isLoading={trendingTv.isLoading}
        />
        <TmdbRow
          title={t("popularShows")}
          items={popularTv.data}
          isLoading={popularTv.isLoading}
        />
        <TmdbRow
          title={t("upcoming")}
          items={upcoming.data}
          isLoading={upcoming.isLoading}
        />
        <TmdbRow
          title={t("topRatedMovies")}
          items={topRated.data}
          isLoading={topRated.isLoading}
        />
      </div>
    </div>
  );
}

function DiscoverHero({
  item,
  discoverLabel,
}: {
  item: TmdbItem;
  discoverLabel: string;
}) {
  const backdrop = tmdbImage(item.backdrop_path, "w1280");
  const year = tmdbYear(item);
  const images = useTmdbImages(tmdbType(item), item.id);
  const logo = tmdbLogo(images.data, "w500");
  return (
    <section className="relative flex min-h-[440px] items-end overflow-hidden">
      {backdrop && (
        <FadeImg
          src={backdrop}
          alt=""
          priority
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
      <div className="relative max-w-[640px] px-10 pb-12">
        <div className="mb-2.5 text-[12px] font-bold tracking-[0.08em] text-accent uppercase">
          {discoverLabel}
        </div>
        {logo ? (
          <FadeImg
            src={logo}
            alt={tmdbTitle(item)}
            priority
            className="mb-4 max-h-[120px] w-auto max-w-[420px] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <h1 className="mb-3 text-[48px] leading-none font-extrabold tracking-[-0.03em] text-balance">
            {tmdbTitle(item)}
          </h1>
        )}
        <div className="mb-4 flex items-center gap-3.5 text-[13.5px] font-semibold text-bright">
          {item.vote_average ? (
            <span className="flex items-center gap-1.5 text-amber-300">
              <Star className="size-4 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
          ) : null}
          {year && <span>{year}</span>}
        </div>
        {item.overview && (
          <p className="mb-6 line-clamp-3 max-w-[560px] text-[15px] leading-relaxed text-para">
            {item.overview}
          </p>
        )}
        <Link
          href={`/discover/${tmdbType(item)}/${item.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-[14.5px] font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
        >
          <Info className="size-5" />
          {discoverLabel}
        </Link>
      </div>
    </section>
  );
}
