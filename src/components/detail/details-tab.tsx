"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Captions, CheckCircle2, Disc3, Layers, Volume2 } from "lucide-react";
import type {
  BaseItemDto,
  MediaStream,
} from "@jellyfin/sdk/lib/generated-client";
import { formatRuntime } from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

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
  const [sourceIndex, setSourceIndex] = useState(0);
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

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {facts.map((f) => (
          <div
            key={f.k}
            className="grid grid-cols-[160px_1fr] gap-5 border-b border-border py-3.5"
          >
            <span className="text-[13.5px] text-muted">{f.k}</span>
            <span className="text-[13.5px] font-semibold">{f.v}</span>
          </div>
        ))}
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
                  key={src.Id ?? i}
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
          <SectionTitle
            icon={<Captions className="size-5" />}
            label={t("subtitlesAvailable")}
          />
          <div className="flex flex-col gap-2">
            {subs.length ? (
              subs.map((s) => (
                <div
                  key={s.Index}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="flex-none rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
                    {s.Codec?.toUpperCase() ?? "SUB"}
                  </span>
                  <span className="flex-1 truncate text-[13px] font-semibold">
                    {s.DisplayTitle ?? s.Language}
                  </span>
                  {s.IsDefault && (
                    <span className="flex-none rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
                      {t("active")}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-[12.5px] text-muted">{t("none")}</span>
            )}
          </div>
        </div>
      </div>
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
