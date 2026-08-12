"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import type {
  BaseItemDto,
  MediaStream,
} from "@jellyfin/sdk/lib/generated-client";
import {
  useDeleteSubtitle,
  useDownloadRemoteSubtitle,
  useRemoteSubtitleSearch,
  useUploadSubtitle,
  type RemoteSubtitleInfo,
} from "@/lib/jellyfin/player-queries";
import { streamsByType } from "@/lib/jellyfin/tracks";
import { Portal } from "@/components/common/portal";
import { cn } from "@/lib/utils";

const SUB_LANGS = [
  ["eng", "English"],
  ["tur", "Türkçe"],
  ["spa", "Español"],
  ["fre", "Français"],
  ["ger", "Deutsch"],
  ["ita", "Italiano"],
  ["por", "Português"],
  ["rus", "Русский"],
  ["ara", "العربية"],
  ["jpn", "日本語"],
] as const;

/**
 * Detail-page subtitle management: list the item's external subtitles (delete),
 * search providers (Open Subtitles) and download, or upload a file. Shares the
 * same write hooks as the in-player panel.
 */
export function SubtitleManagerModal({
  item,
  onClose,
}: {
  item: BaseItemDto;
  onClose: () => void;
}) {
  const t = useTranslations("Player");
  const td = useTranslations("Detail");
  const source = item.MediaSources?.[0];
  const itemId = item.Id ?? "";
  const subs = streamsByType(source, "Subtitle");

  const [lang, setLang] = useState("eng");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const search = useRemoteSubtitleSearch(itemId, lang, searchEnabled);
  const download = useDownloadRemoteSubtitle();
  const upload = useUploadSubtitle();
  const deleteSub = useDeleteSubtitle();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const format = file.name.split(".").pop()?.toLowerCase() || "srt";
    upload.mutate({ itemId, language: lang, format, data: base64 });
    e.target.value = "";
  }

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="animate-jn-pop flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-border-strong bg-bg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-lg font-extrabold">{td("manageSubtitles")}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("off")}
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Current external subtitles */}
            <h4 className="mb-2.5 text-[12px] font-extrabold tracking-[0.08em] text-accent uppercase">
              {td("currentSubtitles")}
            </h4>
            <div className="mb-6 flex flex-col gap-1">
              {subs.filter((s) => s.IsExternal).length === 0 ? (
                <span className="text-[12.5px] text-muted">
                  {td("noExternalSubs")}
                </span>
              ) : (
                subs
                  .filter((s) => s.IsExternal)
                  .map((s: MediaStream) => (
                    <div
                      key={s.Index}
                      className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {s.DisplayTitle ?? s.Language}
                      </span>
                      <span className="text-[11px] text-muted">
                        {s.Codec?.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          s.Index != null &&
                          deleteSub.mutate({ itemId, index: s.Index })
                        }
                        disabled={
                          deleteSub.isPending &&
                          deleteSub.variables?.index === s.Index
                        }
                        aria-label={t("deleteSubtitle")}
                        className="flex size-7 flex-none items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/20 hover:text-danger-soft disabled:opacity-60"
                      >
                        {deleteSub.isPending &&
                        deleteSub.variables?.index === s.Index ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Add: language + search / upload */}
            <h4 className="mb-2.5 text-[12px] font-extrabold tracking-[0.08em] text-accent uppercase">
              {t("addSubtitle")}
            </h4>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SUB_LANGS.map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLang(code);
                    setSearchEnabled(false);
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                    lang === code
                      ? "bg-accent text-on-accent"
                      : "bg-white/[0.08] text-bright hover:bg-white/[0.16]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSearchEnabled(true)}
                disabled={search.isFetching}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-60"
              >
                {search.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {t("searchOnline")}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.08] px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-60"
              >
                {upload.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {t("upload")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".srt,.vtt,.ass,.ssa,.sub"
                onChange={onFile}
                className="hidden"
              />
            </div>

            <div className="max-h-[38vh] overflow-y-auto">
              {searchEnabled && search.isError && (
                <div className="px-2 py-4 text-center text-[12px] text-danger-soft">
                  {t("searchFailed")}
                </div>
              )}
              {searchEnabled &&
                !search.isFetching &&
                (search.data?.length ?? 0) === 0 && (
                  <div className="px-2 py-4 text-center text-[12.5px] text-muted">
                    {t("noSubtitlesFound")}
                  </div>
                )}
              {(search.data ?? []).map((r: RemoteSubtitleInfo) => (
                <div
                  key={r.Id}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-text">
                      {r.Name}
                    </div>
                    <div className="truncate text-[10.5px] text-muted">
                      {[
                        r.ProviderName,
                        r.Format?.toUpperCase(),
                        r.DownloadCount != null ? `↓${r.DownloadCount}` : null,
                        r.IsHashMatch ? "★ match" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      download.mutate({ itemId, subtitleId: r.Id })
                    }
                    disabled={download.isPending}
                    aria-label={t("download")}
                    className="flex size-8 flex-none items-center justify-center rounded-lg bg-white/[0.08] text-white transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
                  >
                    {download.isPending &&
                    download.variables?.subtitleId === r.Id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
