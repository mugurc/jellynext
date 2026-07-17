"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { BaseItemDtoQueryResult } from "@jellyfin/sdk/lib/generated-client";
import { itemImageUrl, jf } from "@/lib/jellyfin/browser";
import { gradientFallback } from "@/lib/jellyfin/media";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useItem } from "@/lib/jellyfin/queries";
import { MediaCard } from "@/components/media/media-card";
import { GridSkeleton } from "@/components/media/skeletons";

export function PersonView({ personId }: { personId: string }) {
  const t = useTranslations("Person");
  const { userId } = useCurrentUser();
  const { data: person } = useItem(personId);

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
        limit: 60,
      }),
  });

  const img =
    person?.Id && person.ImageTags?.Primary
      ? itemImageUrl(person.Id, "Primary", {
          tag: person.ImageTags.Primary,
          maxWidth: 300,
        })
      : null;

  return (
    <div className="animate-jn-fade px-10 pt-8 pb-16">
      <div className="mb-9 flex flex-wrap gap-8">
        <div
          className="size-[180px] flex-none rounded-2xl bg-cover bg-center"
          style={{
            backgroundImage: img
              ? `url("${img}")`
              : gradientFallback(person?.Id),
          }}
        />
        <div className="min-w-[280px] flex-1">
          <h1 className="mb-2.5 text-4xl font-extrabold tracking-tight">
            {person?.Name}
          </h1>
          {person?.PremiereDate && (
            <div className="mb-4 text-[13.5px] text-muted">
              {t("born")} {new Date(person.PremiereDate).toLocaleDateString()}
            </div>
          )}
          {person?.Overview && (
            <p className="max-w-[720px] text-[15px] leading-relaxed text-pretty text-para">
              {person.Overview}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-4 text-[18px] font-bold">{t("filmography")}</h2>
      {films.isLoading ? (
        <GridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-[18px]">
          {(films.data?.Items ?? []).map((i) => (
            <MediaCard key={i.Id} item={i} className="w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
