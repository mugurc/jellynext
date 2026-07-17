"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Info, Play, Plus, Star } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  backdropUrl,
  formatRuntime,
  gradientFallback,
} from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

const ROTATE_MS = 7000;

export function Billboard({ items }: { items: BaseItemDto[] }) {
  const t = useTranslations("Common");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const featured = items.slice(0, 5);

  useEffect(() => {
    if (featured.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % featured.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [featured.length]);

  if (!featured.length) return null;
  const item = featured[index];
  const img = backdropUrl(item, { maxWidth: 1600 });

  return (
    <section className="relative flex h-[600px] items-end overflow-hidden">
      <div
        key={item.Id}
        className="animate-jn-fade absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(item.Id)}`
            : gradientFallback(item.Id),
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />

      <div className="animate-jn-up relative max-w-[660px] px-10 pb-16">
        <div className="mb-4 flex items-center gap-2.5 text-[13px] font-semibold text-muted">
          <span>{item.Type === "Series" ? "Series" : "Movie"}</span>
          {item.Genres?.[0] && <span>· {item.Genres[0]}</span>}
        </div>

        <h1 className="mb-4 text-[62px] leading-none font-extrabold tracking-[-0.03em] text-balance">
          {item.Name}
        </h1>

        <div className="mb-4 flex items-center gap-3 text-[13.5px] font-semibold text-bright">
          {item.CommunityRating != null && (
            <span className="flex items-center gap-1.5 text-accent">
              <Star className="size-4 fill-current" />
              {item.CommunityRating.toFixed(1)}
            </span>
          )}
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.RunTimeTicks && <span>{formatRuntime(item.RunTimeTicks)}</span>}
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

        {featured.length > 1 && (
          <div className="mt-9 flex gap-2">
            {featured.map((f, i) => (
              <button
                key={f.Id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-7 bg-accent" : "w-3 bg-white/30",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
