"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ExternalLink, Film, Library, Star } from "lucide-react";
import {
  tmdbImage,
  tmdbLogo,
  tmdbTrailerUrl,
  useLibraryMatch,
  useTmdbDetail,
  type TmdbCastMember,
} from "@/lib/tmdb/queries";
import { GridSkeleton } from "@/components/media/skeletons";
import { TrailerModal } from "@/components/detail/trailer-modal";

function runtimeLabel(min?: number): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Info-only detail page for a TMDb title (no playback) — used for discovery. */
export function TmdbDetailView({ type, id }: { type: string; id: string }) {
  const t = useTranslations("Discover");
  const router = useRouter();
  const { data: item, isLoading, isError } = useTmdbDetail(type, id);
  const owned = useLibraryMatch(id).data;
  const [trailerOpen, setTrailerOpen] = useState(false);

  if (isLoading) {
    return (
      <div>
        <div className="h-[420px] animate-pulse bg-card/40" />
        <div className="px-10 py-8">
          <GridSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-muted">{t("notFound")}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-white px-6 py-2.5 font-bold text-on-accent"
        >
          <ChevronLeft className="mr-1 inline size-4" />
          {t("back")}
        </button>
      </div>
    );
  }

  const title = item.title ?? item.name ?? "";
  const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);
  const backdrop = tmdbImage(item.backdrop_path, "w1280");
  const poster = tmdbImage(item.poster_path, "w500");
  const logo = tmdbLogo(item.images, "w500");
  const runtime =
    item.runtime ??
    (item.episode_run_time?.length ? item.episode_run_time[0] : undefined);
  const cast = (item.credits?.cast ?? []).slice(0, 12);
  const imdbId = item.imdb_id ?? item.external_ids?.imdb_id;
  const country = item.production_countries?.[0]?.name;
  const trailerUrl = tmdbTrailerUrl(item);

  return (
    <div className="animate-jn-fade">
      {/* Hero */}
      <section className="relative flex min-h-[440px] items-end overflow-hidden">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />

        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("back")}
          className="absolute top-6 left-8 z-20 flex size-11 items-center justify-center rounded-[10px] bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="relative flex w-full items-end gap-7 px-10 pb-9">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={title}
              className="hidden w-[168px] flex-none rounded-xl shadow-2xl ring-1 ring-white/10 sm:block"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-accent uppercase">
              {t("discover")} · {type === "tv" ? t("series") : t("movie")}
            </div>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={title}
                className="animate-jn-fade mb-3 max-h-[110px] w-auto max-w-[420px] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
              />
            ) : (
              <h1 className="mb-3 text-[44px] leading-none font-extrabold tracking-[-0.03em] text-balance">
                {title}
              </h1>
            )}
            {item.tagline && (
              <p className="mb-3 text-[15px] font-medium text-para italic">
                {item.tagline}
              </p>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3.5 text-[13.5px] font-semibold text-bright">
              {item.vote_average ? (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Star className="size-4 fill-current" />
                  {item.vote_average.toFixed(1)}
                </span>
              ) : null}
              {year && <span>{year}</span>}
              {runtime ? <span>{runtimeLabel(runtime)}</span> : null}
              {type === "tv" && item.number_of_seasons ? (
                <span>{t("seasons", { count: item.number_of_seasons })}</span>
              ) : null}
              {item.status && <span className="text-muted">{item.status}</span>}
              {country && <span className="text-muted">{country}</span>}
            </div>

            {item.genres?.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {item.genres.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-semibold text-bright"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Info-only: no playback. Trailer + owned → library page. */}
            <div className="flex flex-wrap items-center gap-3">
              {trailerUrl && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[14px] font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
                >
                  <Film className="size-4" />
                  {t("trailer")}
                </button>
              )}
              {owned?.Id && (
                <Link
                  href={`/item/${owned.Id}`}
                  className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[14px] font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
                >
                  <Library className="size-4" />
                  {t("inLibrary")}
                </Link>
              )}
              {(imdbId || item.homepage) && (
                <a
                  href={
                    imdbId
                      ? `https://www.imdb.com/title/${imdbId}/`
                      : (item.homepage ?? "#")
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:border-white"
                >
                  <ExternalLink className="size-4" />
                  {imdbId ? "IMDb" : t("website")}
                </a>
              )}
              <a
                href={`https://www.themoviedb.org/${type}/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:border-white"
              >
                <ExternalLink className="size-4" />
                TMDb
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="px-10 pt-8 pb-16">
        {item.overview && (
          <p className="mb-10 max-w-[760px] text-[15.5px] leading-relaxed text-pretty text-para">
            {item.overview}
          </p>
        )}

        {cast.length > 0 && (
          <>
            <h2 className="mb-4 text-[18px] font-bold">{t("cast")}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {cast.map((p) => (
                <CastCard key={p.id} person={p} />
              ))}
            </div>
          </>
        )}
      </div>

      {trailerOpen && trailerUrl && (
        <TrailerModal
          url={trailerUrl}
          title={title}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </div>
  );
}

function CastCard({ person }: { person: TmdbCastMember }) {
  const img = tmdbImage(person.profile_path, "w185");
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
      <span
        className="size-12 flex-none rounded-full bg-card bg-cover bg-center"
        style={img ? { backgroundImage: `url("${img}")` } : undefined}
      />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-bold">{person.name}</div>
        <div className="truncate text-[11.5px] text-muted">
          {person.character}
        </div>
      </div>
    </div>
  );
}
