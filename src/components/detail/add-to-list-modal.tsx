"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ListPlus, Plus, X } from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Portal } from "@/components/common/portal";
import {
  useAddToCollection,
  useAddToPlaylist,
  useCollectionsList,
  usePlaylistsList,
} from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

export function AddToListModal({
  item,
  onClose,
}: {
  item: BaseItemDto;
  onClose: () => void;
}) {
  const t = useTranslations("AddToList");
  const collections = useCollectionsList();
  const playlists = usePlaylistsList();
  const addCol = useAddToCollection();
  const addPl = useAddToPlaylist();
  const [newCol, setNewCol] = useState("");
  const [newPl, setNewPl] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());

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

  const id = item.Id ?? "";
  const mark = (key: string) => setDone((s) => new Set(s).add(key));

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="animate-jn-pop max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              <ListPlus className="size-5 text-accent" /> {t("title")}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <ListSection
              title={t("collections")}
              emptyLabel={t("noCollections")}
              items={collections.data?.Items ?? []}
              onAdd={(cid) =>
                addCol.mutate(
                  { collectionId: cid, itemId: id },
                  { onSuccess: () => mark(`c:${cid}`) },
                )
              }
              isDone={(cid) => done.has(`c:${cid}`)}
              newValue={newCol}
              onNewChange={setNewCol}
              onCreate={() =>
                newCol.trim() &&
                addCol.mutate(
                  { name: newCol.trim(), itemId: id },
                  {
                    onSuccess: () => {
                      mark(`c:new:${newCol.trim()}`);
                      setNewCol("");
                    },
                  },
                )
              }
              createLabel={t("newCollection")}
              pending={addCol.isPending}
            />
            <ListSection
              title={t("playlists")}
              emptyLabel={t("noPlaylists")}
              items={playlists.data?.Items ?? []}
              onAdd={(pid) =>
                addPl.mutate(
                  { playlistId: pid, itemId: id },
                  { onSuccess: () => mark(`p:${pid}`) },
                )
              }
              isDone={(pid) => done.has(`p:${pid}`)}
              newValue={newPl}
              onNewChange={setNewPl}
              onCreate={() =>
                newPl.trim() &&
                addPl.mutate(
                  { name: newPl.trim(), itemId: id },
                  {
                    onSuccess: () => {
                      mark(`p:new:${newPl.trim()}`);
                      setNewPl("");
                    },
                  },
                )
              }
              createLabel={t("newPlaylist")}
              pending={addPl.isPending}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}

function ListSection({
  title,
  emptyLabel,
  items,
  onAdd,
  isDone,
  newValue,
  onNewChange,
  onCreate,
  createLabel,
  pending,
}: {
  title: string;
  emptyLabel: string;
  items: BaseItemDto[];
  onAdd: (id: string) => void;
  isDone: (id: string) => boolean;
  newValue: string;
  onNewChange: (v: string) => void;
  onCreate: () => void;
  createLabel: string;
  pending?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-extrabold tracking-[0.08em] text-accent">
        {title}
      </h4>
      <div className="flex flex-col gap-1">
        {items.length ? (
          items.map((it) => {
            const added = isDone(it.Id ?? "");
            return (
              <button
                key={it.Id}
                type="button"
                onClick={() => it.Id && onAdd(it.Id)}
                disabled={pending || added}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold transition-colors hover:bg-white/[0.06] disabled:opacity-70"
              >
                <span className="truncate">{it.Name}</span>
                {added ? (
                  <Check className="size-4 flex-none text-emerald-400" />
                ) : (
                  <Plus className="size-4 flex-none text-muted" />
                )}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-1.5 text-[12.5px] text-dim">{emptyLabel}</p>
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate();
        }}
      >
        <input
          value={newValue}
          onChange={(e) => onNewChange(e.target.value)}
          placeholder={createLabel}
          className="h-9 flex-1 rounded-lg border border-border-strong bg-white/[0.05] px-3 text-[13px] text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!newValue.trim() || pending}
          className={cn(
            "flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50",
          )}
        >
          <Plus className="size-3.5" />
        </button>
      </form>
    </div>
  );
}
