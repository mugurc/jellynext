"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Search, X } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  useApplyIdentify,
  useIdentifySearch,
  type RemoteSearchResult,
} from "@/lib/jellyfin/queries";
import { Portal } from "@/components/common/portal";

const IDENTIFY_TYPES: Record<string, string> = {
  Movie: "Movie",
  Series: "Series",
  BoxSet: "BoxSet",
  Person: "Person",
  MusicAlbum: "MusicAlbum",
  MusicArtist: "MusicArtist",
};

/** Admin: re-match an item's metadata by searching external providers. */
export function IdentifyModal({
  item,
  onClose,
}: {
  item: BaseItemDto;
  onClose: () => void;
}) {
  const t = useTranslations("Identify");
  const search = useIdentifySearch();
  const apply = useApplyIdentify();
  const itemType = IDENTIFY_TYPES[item.Type ?? ""] ?? "Movie";

  const [name, setName] = useState(item.Name ?? "");
  const [year, setYear] = useState(item.ProductionYear?.toString() ?? "");
  const [applied, setApplied] = useState(false);

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

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    search.mutate({
      itemType,
      name: name.trim(),
      year: year ? Number(year) : undefined,
    });
  }

  function choose(result: RemoteSearchResult) {
    if (!item.Id) return;
    apply.mutate(
      { itemId: item.Id, result },
      {
        onSuccess: () => {
          setApplied(true);
          setTimeout(onClose, 1200);
        },
      },
    );
  }

  const results = search.data ?? [];

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="animate-jn-pop flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border-strong bg-bg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-lg font-extrabold">{t("title")}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={runSearch} className="mb-4 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name")}
                autoFocus
                className="h-10 flex-1 rounded-lg border border-border-strong bg-white/[0.05] px-3.5 text-[14px] text-text outline-none focus:border-accent"
              />
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={t("year")}
                inputMode="numeric"
                className="h-10 w-20 rounded-lg border border-border-strong bg-white/[0.05] px-3 text-[14px] text-text outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={search.isPending || !name.trim()}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-bold text-on-accent disabled:opacity-50"
              >
                {search.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {t("search")}
              </button>
            </form>

            {applied && (
              <p className="rounded-lg bg-accent/15 px-3 py-2 text-[13px] font-semibold text-accent">
                {t("applied")}
              </p>
            )}

            {search.isSuccess && results.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted">
                {t("noResults")}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <button
                  key={`${r.ProviderIds?.Tmdb ?? r.Name}-${i}`}
                  type="button"
                  onClick={() => choose(r)}
                  disabled={apply.isPending}
                  className="flex items-center gap-3 rounded-xl border border-border p-2.5 text-left transition-colors hover:border-accent hover:bg-white/[0.03] disabled:opacity-60"
                >
                  <div
                    className="aspect-[2/3] w-12 flex-none rounded-md bg-card bg-cover bg-center"
                    style={{
                      backgroundImage: r.ImageUrl
                        ? `url("${r.ImageUrl}")`
                        : undefined,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold">
                        {r.Name}
                      </span>
                      {r.ProductionYear && (
                        <span className="flex-none text-[12px] text-muted">
                          {r.ProductionYear}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-dim">
                      <span>{r.SearchProviderName}</span>
                      {r.ProviderIds?.Tmdb && (
                        <span>TMDb {r.ProviderIds.Tmdb}</span>
                      )}
                    </div>
                    {r.Overview && (
                      <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                        {r.Overview}
                      </p>
                    )}
                  </div>
                  {apply.isPending &&
                    apply.variables?.result === r &&
                    !applied && (
                      <Loader2 className="size-4 flex-none animate-spin text-accent" />
                    )}
                  {applied && apply.variables?.result === r && (
                    <Check className="size-5 flex-none text-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
