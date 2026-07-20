"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Captions,
  CheckCircle2,
  Disc3,
  Layers,
  Plus,
  Volume2,
} from "lucide-react";
import type {
  BaseItemDto,
  MediaStream,
} from "@jellyfin/sdk/lib/generated-client";
import { formatRuntime } from "@/lib/jellyfin/media";
import { useCurrentUser } from "@/lib/auth/current-user";
import { SubtitleManagerModal } from "./subtitle-manager-modal";
import { cn } from "@/lib/utils";

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function streamsOfType(
  source: BaseItemDto["MediaSources"],
  index: number,
  type: string,
) {
  return (source?.[index]?.MediaStreams ?? []).filter(
    (s) => String(s.Type) === type,
  );
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export function DetailsTab({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Detail");
  const { isAdmin } = useCurrentUser();
  const [sourceIndex, setSourceIndex] = useState(0);
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const libraryBase =
    item.Type === "Series" || item.Type === "Episode" ? "/tv" : "/movies";
  // Subtitle management applies to playable items with a media source.
  const canManageSubs =
    (item.Type === "Movie" ||
      item.Type === "Episode" ||
      item.Type === "Video") &&
    (item.MediaSources?.length ?? 0) > 0;
  const sources = item.MediaSources ?? [];

  const audio = streamsOfType(sources, sourceIndex, "Audio");
  const subs = streamsOfType(sources, sourceIndex, "Subtitle");
  const video = streamsOfType(sources, sourceIndex, "Video")[0] as
    MediaStream | undefined;

  const directors = (item.People ?? [])
    .filter((p) => p.Type === "Director")
    .map((p) => p.Name)
    .filter(Boolean);
  const writers = (item.People ?? [])
    .filter((p) => p.Type === "Writer")
    .map((p) => p.Name)
    .filter(Boolean);
  const audioLangs = [...new Set(audio.map((a) => a.Language).filter(Boolean))];
  const subLangs = [...new Set(subs.map((s) => s.Language).filter(Boolean))];
  // Deduplicated human-readable subtitle language names for the chip list.
  const subtitleNames = [
    ...new Map(
      subs.map((s) => {
        const name = (s.DisplayTitle ?? s.Language ?? "")
          .split(" - ")[0]
          .trim();
        return [name.toLowerCase(), name];
      }),
    ).values(),
  ].filter(Boolean);
  const SUB_CHIP_CAP = 18;

  const facts: { k: string; v: string }[] = [];
  const push = (k: string, v?: string | null) => v && facts.push({ k, v });
  push(t("factGenres"), item.Genres?.join(", "));
  push(
    t("factReleased"),
    item.PremiereDate
      ? new Date(item.PremiereDate).getFullYear().toString()
      : item.ProductionYear?.toString(),
  );
  push(t("factRating"), item.CommunityRating?.toFixed(1));
  push(t("factOfficialRating"), item.OfficialRating);
  push(t("factRuntime"), formatRuntime(item.RunTimeTicks));
  push(t("factStudios"), item.Studios?.map((s) => s.Name).join(", "));
  push(t("factDirectors"), directors.join(", "));
  push(t("factWriters"), writers.join(", "));
  push(t("factVideo"), video?.DisplayTitle);
  push(t("factAudioLangs"), audioLangs.join(", "));
  push(t("factSubtitles"), subLangs.join(", "));
  push(t("factCountry"), item.ProductionLocations?.join(", "));
  push(t("factAdded"), formatDate(item.DateCreated));
  push(
    t("factPlayCount"),
    item.UserData?.PlayCount ? String(item.UserData.PlayCount) : undefined,
  );
  push(t("factLastPlayed"), formatDate(item.UserData?.LastPlayedDate));
  if (isAdmin) push(t("factPath"), item.Path);

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {facts.map((f) => (
          <div
            key={f.k}
            className="grid grid-cols-[160px_1fr] gap-5 border-b border-border py-3.5"
          >
            <span className="text-[13.5px] text-muted">{f.k}</span>
            <span className="text-[13.5px] font-semibold break-words">
              {f.v}
            </span>
          </div>
        ))}

        {item.ExternalUrls && item.ExternalUrls.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2.5 text-[12px] font-extrabold tracking-[0.08em] text-accent uppercase">
              {t("linksTitle")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {item.ExternalUrls.filter((u) => u.Url).map((u) => (
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
          </div>
        )}

        {item.Tags && item.Tags.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2.5 text-[12px] font-extrabold tracking-[0.08em] text-accent uppercase">
              {t("tagsTitle")}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {item.Tags.map((tag) => (
                <Link
                  key={tag}
                  href={`${libraryBase}?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-bright transition-colors hover:bg-accent hover:text-on-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {sources.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <SectionTitle
              icon={<Layers className="size-5" />}
              label={t("versions")}
            />
            <div className="mb-5 flex flex-col gap-2">
              {sources.map((src, i) => (
                <button
                  key={`${src.Id ?? "src"}-${i}`}
                  type="button"
                  onClick={() => setSourceIndex(i)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    i === sourceIndex
                      ? "border-accent/60 bg-accent/[0.08]"
                      : "border-border hover:bg-white/[0.03]",
                  )}
                >
                  <Disc3 className="size-4 flex-none text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold">
                      {src.Name ?? item.Name}
                    </div>
                    <div className="text-[11px] text-muted">
                      {[src.Container?.toUpperCase(), formatBytes(src.Size)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {i === sourceIndex && (
                    <CheckCircle2 className="size-4 flex-none text-accent" />
                  )}
                </button>
              ))}
            </div>

            <SectionTitle
              icon={<Volume2 className="size-5" />}
              label={t("audioTracks")}
            />
            <div className="flex flex-col">
              {audio.length ? (
                audio.map((a) => (
                  <div
                    key={a.Index}
                    className="flex items-center gap-3 rounded-lg px-1.5 py-2 hover:bg-white/[0.03]"
                  >
                    <span className="size-2 flex-none rounded-full bg-muted" />
                    <span className="flex-1 text-[12.5px] font-semibold">
                      {a.DisplayTitle ?? a.Language}
                    </span>
                    <span className="text-[11px] text-muted">
                      {a.Codec?.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-[12.5px] text-muted">{t("none")}</span>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <SectionTitle
              icon={<Captions className="size-5" />}
              label={t("subtitlesAvailable")}
            />
            {canManageSubs && (
              <button
                type="button"
                onClick={() => setSubsOpen(true)}
                className="mb-3.5 flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1.5 text-[12px] font-bold text-accent transition-colors hover:bg-accent/10"
              >
                <Plus className="size-3.5" /> {t("manageSubtitles")}
              </button>
            )}
          </div>
          {subtitleNames.length ? (
            <>
              <div className="-mt-1 mb-3 text-[12.5px] text-muted">
                {t("subtitleLangCount", { count: subtitleNames.length })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllSubs
                  ? subtitleNames
                  : subtitleNames.slice(0, SUB_CHIP_CAP)
                ).map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-bright"
                  >
                    {name}
                  </span>
                ))}
              </div>
              {subtitleNames.length > SUB_CHIP_CAP && (
                <button
                  type="button"
                  onClick={() => setShowAllSubs((v) => !v)}
                  className="mt-3 text-[12.5px] font-bold text-accent transition-[filter] hover:brightness-110"
                >
                  {showAllSubs
                    ? t("showLess")
                    : t("showMore", {
                        count: subtitleNames.length - SUB_CHIP_CAP,
                      })}
                </button>
              )}
            </>
          ) : (
            <span className="text-[12.5px] text-muted">{t("none")}</span>
          )}
        </div>
      </div>

      {subsOpen && (
        <SubtitleManagerModal item={item} onClose={() => setSubsOpen(false)} />
      )}
    </div>
  );
}

function SectionTitle({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="text-accent">{icon}</span>
      <h3 className="text-[15px] font-bold">{label}</h3>
    </div>
  );
}
