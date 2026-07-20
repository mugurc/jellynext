"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImageIcon } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { backdropUrl, posterUrl } from "@/lib/jellyfin/media";
import { useRemoteImages } from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

/** A staged image pick (applied only when the edit form is saved). */
export type StagedImages = Partial<Record<"Primary" | "Backdrop", string>>;

/**
 * Controlled image picker — selecting a provider image only STAGES it (shows a
 * preview); nothing is written to the server until the parent form saves.
 */
export function ItemImages({
  item,
  staged,
  onStage,
}: {
  item: BaseItemDto;
  staged: StagedImages;
  onStage: (type: "Primary" | "Backdrop", url: string) => void;
}) {
  const t = useTranslations("ItemEdit");
  return (
    <div className="flex flex-col gap-5">
      <ImageTypeRow
        item={item}
        type="Primary"
        label={t("poster")}
        current={staged.Primary ?? posterUrl(item, { maxWidth: 200 })}
        pending={Boolean(staged.Primary)}
        onStage={onStage}
        wide={false}
      />
      <ImageTypeRow
        item={item}
        type="Backdrop"
        label={t("backdrop")}
        current={staged.Backdrop ?? backdropUrl(item, { maxWidth: 320 })}
        pending={Boolean(staged.Backdrop)}
        onStage={onStage}
        wide
      />
    </div>
  );
}

function ImageTypeRow({
  item,
  type,
  label,
  current,
  pending,
  onStage,
  wide,
}: {
  item: BaseItemDto;
  type: "Primary" | "Backdrop";
  label: string;
  current: string | null;
  pending: boolean;
  onStage: (type: "Primary" | "Backdrop", url: string) => void;
  wide: boolean;
}) {
  const t = useTranslations("ItemEdit");
  const [open, setOpen] = useState(false);
  const remote = useRemoteImages(item.Id, type, open);
  const images = (remote.data?.Images ?? []).filter((i) => i.Url);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative flex-none overflow-hidden rounded-lg bg-card bg-cover bg-center",
            wide ? "aspect-video w-28" : "aspect-[2/3] w-16",
          )}
          style={{
            backgroundImage: current ? `url("${current}")` : undefined,
          }}
        >
          {!current && (
            <div className="flex size-full items-center justify-center text-dim">
              <ImageIcon className="size-5" />
            </div>
          )}
          {pending && (
            <span className="absolute inset-x-0 bottom-0 bg-accent/90 py-0.5 text-center text-[9px] font-bold text-on-accent uppercase">
              {t("pending")}
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold">{label}</div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 text-[12.5px] font-bold text-accent hover:brightness-110"
          >
            {open ? t("hideImages") : t("changeImage")}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          {remote.isLoading ? (
            <div className="py-4 text-center text-[12.5px] text-muted">…</div>
          ) : images.length ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {images.map((img) => {
                const selected = pending && current === img.Url;
                return (
                  <button
                    key={img.Url}
                    type="button"
                    onClick={() => img.Url && onStage(type, img.Url)}
                    title={`${img.ProviderName ?? ""} ${img.Width ?? ""}×${img.Height ?? ""}`}
                    className={cn(
                      "relative flex-none overflow-hidden rounded-lg border bg-card bg-cover bg-center transition",
                      selected
                        ? "border-accent ring-2 ring-accent"
                        : "border-border-strong hover:border-accent",
                      wide ? "aspect-video w-40" : "aspect-[2/3] w-24",
                    )}
                    style={{ backgroundImage: `url("${img.Url}")` }}
                  >
                    {selected && (
                      <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-[12.5px] text-dim">{t("noImages")}</p>
          )}
        </div>
      )}
    </div>
  );
}
