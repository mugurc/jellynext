"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import type { BaseItemDtoQueryResult } from "@jellyfin/sdk/lib/generated-client";
import { itemImageUrl, jf } from "@/lib/jellyfin/browser";
import { gradientFallback } from "@/lib/jellyfin/media";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useItem } from "@/lib/jellyfin/queries";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";

function yearsBetween(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--;
  return age;
}

export function PersonView({ personId }: { personId: string }) {
  const t = useTranslations("Person");
  const { userId } = useCurrentUser();
  const { data: person } = useItem(personId);
  const [expanded, setExpanded] = useState(false);

  const films = useQuery({
    queryKey: ["filmography", userId, personId],
    queryFn: () =>
      jf.get<BaseItemDtoQueryResult>("/Items", {
        userId,
        personIds: personId,
        recursive: true,
        includeItemTypes: "Movie,Series",
        sortBy: "ProductionYear,SortName",
        sortOrder: "Descending",
        fields: "ProductionYear,PrimaryImageAspectRatio,CommunityRating,Genres",
        limit: 100,
      }),
  });

  const img =
    person?.Id && person.ImageTags?.Primary
      ? itemImageUrl(person.Id, "Primary", {
          tag: person.ImageTags.Primary,
          maxWidth: 400,
        })
      : null;

  const birth = person?.PremiereDate ? new Date(person.PremiereDate) : null;
  const death = person?.EndDate ? new Date(person.EndDate) : null;
  const age =
    birth && !Number.isNaN(birth.getTime())
      ? yearsBetween(birth, death ?? new Date())
      : null;
  const birthplace = person?.ProductionLocations?.[0];
  const links = (person?.ExternalUrls ?? []).filter((u) => u.Url);
  const overview = person?.Overview ?? "";
  const longBio = overview.length > 520;

  const filmItems = films.data?.Items ?? [];

  return (
    <div className="animate-jn-fade">
      {/* Hero with the portrait echoed as a blurred backdrop. */}
      <section className="relative overflow-hidden px-10 pt-10 pb-8">
        {img && (
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-20 blur-2xl"
            style={{ backgroundImage: `url("${img}")` }}
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <div className="flex flex-wrap gap-8">
          <div
            className="size-[200px] flex-none rounded-2xl bg-cover bg-center shadow-2xl ring-1 ring-white/10"
            style={{
              backgroundImage: img
                ? `url("${img}")`
                : gradientFallback(person?.Id),
            }}
          />
          <div className="min-w-[280px] flex-1">
            <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-accent uppercase">
              {t("person")}
            </div>
            <h1 className="mb-3 text-[42px] leading-none font-extrabold tracking-tight">
              {person?.Name}
            </h1>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] font-semibold text-bright">
              {birth && !Number.isNaN(birth.getTime()) && (
                <span>
                  {t("born")} {birth.toLocaleDateString()}
                  {age != null && !death && (
                    <span className="text-muted">
                      {" "}
                      · {t("ageYears", { age })}
                    </span>
                  )}
                </span>
              )}
              {death && !Number.isNaN(death.getTime()) && (
                <span>
                  {t("died")} {death.toLocaleDateString()}
                  {age != null && (
                    <span className="text-muted">
                      {" "}
                      · {t("agedYears", { age })}
                    </span>
                  )}
                </span>
              )}
              {birthplace && (
                <span className="flex items-center gap-1.5 text-muted">
                  <MapPin className="size-3.5" /> {birthplace}
                </span>
              )}
            </div>

            {links.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {links.map((u) => (
                  <a
                    key={u.Name ?? u.Url}
                    href={u.Url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border-strong bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-semibold text-bright transition-colors hover:border-accent hover:text-accent"
                  >
                    {u.Name}
                  </a>
                ))}
              </div>
            )}

            {overview && (
              <div className="max-w-[760px]">
                <p
                  className={`text-[15px] leading-relaxed text-pretty text-para ${
                    longBio && !expanded ? "line-clamp-5" : ""
                  }`}
                >
                  {overview}
                </p>
                {longBio && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1.5 text-[13px] font-bold text-accent transition-[filter] hover:brightness-110"
                  >
                    {expanded ? t("showLess") : t("showMore")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="px-10 pb-16">
        <h2 className="mb-4 flex items-baseline gap-2.5 text-[18px] font-bold">
          {t("filmography")}
          {filmItems.length > 0 && (
            <span className="text-[13px] font-semibold text-muted">
              {filmItems.length}
            </span>
          )}
        </h2>
        {films.isLoading ? (
          <GridSkeleton count={6} />
        ) : filmItems.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-[18px]">
            {filmItems.map((i) => (
              <MediaCard key={i.Id} item={i} className="w-full" />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-muted">{t("noTitles")}</p>
        )}
      </div>
    </div>
  );
}
