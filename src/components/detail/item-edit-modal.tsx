"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, X } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import {
  useDownloadRemoteImage,
  useRefreshItem,
  useUpdateItem,
} from "@/lib/jellyfin/queries";
import { ItemImages, type StagedImages } from "./item-images";
import { Portal } from "@/components/common/portal";
import { cn } from "@/lib/utils";

const splitCsv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const joinCsv = (a?: (string | null | undefined)[] | null) =>
  (a ?? []).filter(Boolean).join(", ");

export function ItemEditModal({
  item,
  onClose,
}: {
  item: BaseItemDto;
  onClose: () => void;
}) {
  const t = useTranslations("ItemEdit");
  const update = useUpdateItem();
  const refresh = useRefreshItem();
  const downloadImage = useDownloadRemoteImage();
  const [staged, setStaged] = useState<StagedImages>({});
  const stageImage = (type: "Primary" | "Backdrop", url: string) =>
    setStaged((s) => ({ ...s, [type]: url }));

  const [name, setName] = useState(item.Name ?? "");
  const [originalTitle, setOriginalTitle] = useState(item.OriginalTitle ?? "");
  const [overview, setOverview] = useState(item.Overview ?? "");
  const [genres, setGenres] = useState(joinCsv(item.Genres));
  const [tags, setTags] = useState(joinCsv(item.Tags));
  const [studios, setStudios] = useState(
    joinCsv((item.Studios ?? []).map((s) => s.Name)),
  );
  const [year, setYear] = useState(item.ProductionYear?.toString() ?? "");
  const [officialRating, setOfficialRating] = useState(
    item.OfficialRating ?? "",
  );
  const [communityRating, setCommunityRating] = useState(
    item.CommunityRating?.toString() ?? "",
  );
  const [premiereDate, setPremiereDate] = useState(
    item.PremiereDate ? item.PremiereDate.slice(0, 10) : "",
  );

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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const id = item.Id;
    if (!id) return;
    const updated: BaseItemDto = {
      ...item,
      Name: name.trim(),
      OriginalTitle: originalTitle.trim() || null,
      Overview: overview.trim() || null,
      Genres: splitCsv(genres),
      Tags: splitCsv(tags),
      Studios: splitCsv(studios).map((n) => ({ Name: n })),
      ProductionYear: year ? Number(year) : null,
      OfficialRating: officialRating.trim() || null,
      CommunityRating: communityRating ? Number(communityRating) : null,
      PremiereDate: premiereDate ? `${premiereDate}T00:00:00.0000000Z` : null,
    };
    try {
      // Metadata first, then any staged images (image writes go last so they
      // stick). Nothing is persisted until Save is pressed.
      await update.mutateAsync({ id, item: updated });
      if (staged.Primary) {
        await downloadImage.mutateAsync({
          itemId: id,
          type: "Primary",
          imageUrl: staged.Primary,
        });
      }
      if (staged.Backdrop) {
        await downloadImage.mutateAsync({
          itemId: id,
          type: "Backdrop",
          imageUrl: staged.Backdrop,
          currentCount: item.BackdropImageTags?.length ?? 0,
        });
      }
      onClose();
    } catch {
      // update.isError surfaces the message; keep the modal open to retry.
    }
  }

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="animate-jn-pop max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold">{t("title")}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => item.Id && refresh.mutate(item.Id)}
                disabled={refresh.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-[12.5px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    refresh.isPending && "animate-spin",
                  )}
                />
                {t("refreshMetadata")}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="mb-5 border-b border-border pb-5">
            <h4 className="mb-3 text-[12px] font-extrabold tracking-[0.08em] text-accent">
              {t("images")}
            </h4>
            <ItemImages item={item} staged={staged} onStage={stageImage} />
          </div>

          <form onSubmit={save} className="flex flex-col gap-3.5">
            <Field
              label={t("name")}
              value={name}
              onChange={setName}
              autoFocus
            />
            <Field
              label={t("originalTitle")}
              value={originalTitle}
              onChange={setOriginalTitle}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">
                {t("overview")}
              </span>
              <textarea
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                rows={4}
                className="rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-relaxed text-text outline-none focus:border-accent"
              />
            </label>
            <Field
              label={t("genres")}
              value={genres}
              onChange={setGenres}
              hint={t("csvHint")}
            />
            <Field
              label={t("tags")}
              value={tags}
              onChange={setTags}
              hint={t("csvHint")}
            />
            <Field
              label={t("studios")}
              value={studios}
              onChange={setStudios}
              hint={t("csvHint")}
            />
            <div className="grid grid-cols-2 gap-3.5">
              <Field
                label={t("year")}
                value={year}
                onChange={setYear}
                type="number"
              />
              <Field
                label={t("premiereDate")}
                value={premiereDate}
                onChange={setPremiereDate}
                type="date"
              />
              <Field
                label={t("officialRating")}
                value={officialRating}
                onChange={setOfficialRating}
              />
              <Field
                label={t("communityRating")}
                value={communityRating}
                onChange={setCommunityRating}
                type="number"
              />
            </div>

            {update.isError && (
              <p className="text-[13px] font-semibold text-danger-soft">
                {t("saveFailed")}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-border-strong px-4 py-2.5 text-[13px] font-bold text-muted hover:bg-white/[0.06]"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={
                  !name.trim() || update.isPending || downloadImage.isPending
                }
                className="flex items-center gap-1.5 rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
              >
                {(update.isPending || downloadImage.isPending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 text-[14px] text-text outline-none focus:border-accent"
      />
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}
