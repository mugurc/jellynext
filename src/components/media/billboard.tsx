"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Plus,
  Star,
} from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  backdropUrl,
  formatRuntime,
  gradientFallback,
  logoUrl,
} from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

const ROTATE_MS = 7000;

export function Billboard({ items }: { items: BaseItemDto[] }) {
  const t = useTranslations("Common");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const featured = items.slice(0, 5);
  const count = featured.length;

  // Auto-advance; the timer re-arms on every index change so a manual jump
  // also gives the new slide a full dwell before the next auto-advance.
  useEffect(() => {
    if (count < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, count]);

  if (!count) return null;
  const item = featured[index];
  const logo = logoUrl(item, { maxHeight: 260 });
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);

  return (
    <section className="relative flex h-[600px] items-end overflow-hidden">
      {/* Stacked backdrops crossfade between slides. */}
      {featured.map((f, i) => {
        const bg = backdropUrl(f, { maxWidth: 1600 });
        return (
          <div
            key={f.Id}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 bg-cover bg-center transition-opacity duration-[900ms] ease-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
            style={{
              backgroundImage: bg
                ? `url("${bg}"), ${gradientFallback(f.Id)}`
                : gradientFallback(f.Id),
            }}
          />
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("previous")}
            className="absolute top-1/2 left-4 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/75 backdrop-blur-sm transition hover:scale-105 hover:bg-black/55 hover:text-white"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("next")}
            className="absolute top-1/2 right-4 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/75 backdrop-blur-sm transition hover:scale-105 hover:bg-black/55 hover:text-white"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <div className="relative max-w-[660px] px-10 pb-16">
        {/* Text content re-animates (fade + small rise) on each slide… */}
        <div key={item.Id} className="animate-jn-up">
          <div className="mb-4 flex items-center gap-2.5 text-[13px] font-semibold text-muted">
            <span>{item.Type === "Series" ? "Series" : "Movie"}</span>
            {item.Genres?.[0] && <span>· {item.Genres[0]}</span>}
          </div>

          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={item.Name ?? ""}
              className="mb-5 max-h-[130px] w-auto max-w-[440px] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <h1 className="mb-4 text-[62px] leading-none font-extrabold tracking-[-0.03em] text-balance">
              {item.Name}
            </h1>
          )}

          <div className="mb-4 flex items-center gap-3 text-[13.5px] font-semibold text-bright">
            {item.CommunityRating != null && (
              <span className="flex items-center gap-1.5 text-accent">
                <Star className="size-4 fill-current" />
                {item.CommunityRating.toFixed(1)}
              </span>
            )}
            {item.ProductionYear && <span>{item.ProductionYear}</span>}
            {item.RunTimeTicks && (
              <span>{formatRuntime(item.RunTimeTicks)}</span>
            )}
            {item.OfficialRating && (
              <span className="rounded border border-bright/40 px-1.5 text-[11.5px]">
                {item.OfficialRating}
              </span>
            )}
          </div>

          {item.Overview && (
            <p className="mb-6 line-clamp-3 max-w-[540px] text-[15.5px] leading-relaxed text-pretty text-para">
              {item.Overview}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/watch/${item.Id}`)}
              className="flex items-center gap-2.5 rounded-lg bg-white px-8 py-3.5 text-base font-extrabold text-on-accent transition hover:bg-[#d9f7fb]"
            >
              <Play className="size-5 fill-current" /> {t("play")}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/item/${item.Id}`)}
              className="flex items-center gap-2 rounded-lg bg-white/[0.15] px-6 py-3.5 text-[15px] font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <Info className="size-5" /> {t("details")}
            </button>
            <button
              type="button"
              aria-label={t("watchlist")}
              className="flex size-[50px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        {/* …but the indicator stays put — only the active pill's fill animates. */}
        {count > 1 && (
          <div className="mt-9 flex items-center gap-2">
            {featured.map((f, i) => {
              const active = i === index;
              return (
                <button
                  key={f.Id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  aria-current={active}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-out",
                    active
                      ? "w-8 bg-white/25"
                      : "w-3 bg-white/25 hover:bg-white/45",
                  )}
                >
                  {active && (
                    <span
                      key={index}
                      className="jn-bb-progress absolute inset-y-0 left-0 rounded-full bg-accent"
                      style={{ animationDuration: `${ROTATE_MS}ms` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
