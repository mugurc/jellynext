"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { backdropUrl, posterUrl } from "@/lib/jellyfin/media";
import {
  useCollectionItems,
  useDeleteItem,
  useMovePlaylistItem,
  usePlaylistItems,
  useRemoveFromCollection,
  useRemoveFromPlaylist,
  useUpdateItem,
  useUpdatePlaylist,
} from "@/lib/jellyfin/queries";
import { useCurrentUser } from "@/lib/auth/current-user";
import { usePlayQueue } from "@/lib/player/queue";
import { Portal } from "@/components/common/portal";
import { PlaylistShareModal } from "@/components/detail/playlist-share-modal";
import { ListSkeleton } from "@/components/media/skeletons";
import { InlineError } from "@/components/common/query-state";
import { Art } from "@/components/common/art";

const PLAYABLE = ["Movie", "Episode", "Video", "MusicVideo", "Audio"];

/** Collection (BoxSet) or Playlist detail with membership management. */
export function CollectionView({ item }: { item: BaseItemDto }) {
  const t = useTranslations("Collection");
  const router = useRouter();
  const isPlaylist = item.Type === "Playlist";
  const id = item.Id ?? "";

  const collectionItems = useCollectionItems(isPlaylist ? undefined : id);
  const playlistItems = usePlaylistItems(isPlaylist ? id : undefined);
  const query = isPlaylist ? playlistItems : collectionItems;
  const items = query.data?.Items ?? [];

  const { isAdmin } = useCurrentUser();
  const removeCol = useRemoveFromCollection();
  const removePl = useRemoveFromPlaylist();
  const move = useMovePlaylistItem();
  const update = useUpdateItem();
  const updatePlaylist = useUpdatePlaylist();
  const deleteItem = useDeleteItem();
  const setQueue = usePlayQueue((s) => s.setQueue);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.Name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);

  // A playlist is the user's own: renaming goes through the playlist API and
  // deleting is allowed for its owner. A BoxSet is library metadata — both
  // operations need admin rights, so don't offer buttons that can only 403.
  const canManage = isPlaylist || isAdmin;
  const renaming = isPlaylist ? updatePlaylist : update;

  const backdrop = backdropUrl(item, { maxWidth: 1600 });

  // A collection can hold containers (series, other collections), and none of
  // those are playable. The button used to be enabled for them and then return
  // silently — no navigation, no message, nothing.
  const playableIds = items
    .filter((i) => i.Type && PLAYABLE.includes(i.Type))
    .map((i) => i.Id)
    .filter((x): x is string => Boolean(x));

  function playAll() {
    if (!playableIds.length) return;
    setQueue(playableIds, item.Name ?? "");
    router.push(`/watch/${playableIds[0]}`);
  }

  function removeItem(entry: BaseItemDto) {
    if (isPlaylist) {
      if (entry.PlaylistItemId)
        removePl.mutate({ playlistId: id, entryId: entry.PlaylistItemId });
    } else if (entry.Id) {
      removeCol.mutate({ collectionId: id, itemId: entry.Id });
    }
  }

  function moveItem(index: number, dir: -1 | 1) {
    const entry = items[index];
    if (!entry?.PlaylistItemId) return;
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    move.mutate({
      playlistId: id,
      entryId: entry.PlaylistItemId,
      newIndex: target,
    });
  }

  function saveName() {
    if (!item.Id || !name.trim()) return;
    const done = { onSuccess: () => setEditing(false) };
    if (isPlaylist) {
      // POST /Playlists/{id} — the owner-facing rename, no admin rights needed.
      updatePlaylist.mutate(
        { playlistId: item.Id, body: { Name: name.trim() } },
        done,
      );
    } else {
      update.mutate(
        { id: item.Id, item: { ...item, Name: name.trim() } },
        done,
      );
    }
  }

  const removing = removeCol.isPending || removePl.isPending ? true : false;

  return (
    <div className="animate-jn-fade">
      <section className="relative flex min-h-[340px] items-end overflow-hidden">
        <Art
          src={backdrop}
          seed={item.Id}
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />

        <div className="relative w-full px-10 pb-9">
          <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-accent uppercase">
            {isPlaylist ? t("playlist") : t("collection")}
          </div>
          {editing ? (
            <div className="mb-3 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="h-12 max-w-[480px] flex-1 rounded-lg border border-border-strong bg-white/[0.06] px-4 text-[28px] font-extrabold text-text outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={renaming.isPending || !name.trim()}
                className="flex h-11 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-extrabold text-on-accent disabled:opacity-50"
              >
                {renaming.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(item.Name ?? "");
                }}
                className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>
          ) : (
            <h1 className="mb-3 text-[46px] leading-none font-extrabold tracking-[-0.03em]">
              {item.Name}
            </h1>
          )}
          <div className="mb-5 text-[13.5px] text-muted">
            {/* The count sits outside the loading branch below, so it used to
                assert "0 items" while the rows were still coming. */}
            {query.isLoading
              ? "\u00a0"
              : t("itemCount", { count: items.length })}
          </div>

          {/* Writes here can be refused by the server (rights, locked item);
              say so instead of leaving the edit looking like it applied. */}
          {(renaming.isError ||
            deleteItem.isError ||
            removeCol.isError ||
            removePl.isError ||
            move.isError) && (
            <p
              role="alert"
              className="mb-4 flex items-center gap-1.5 text-[13px] font-semibold text-danger-soft"
            >
              <AlertTriangle className="size-4" />
              {t("actionFailed")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={playAll}
              disabled={!playableIds.length}
              title={playableIds.length ? undefined : t("nothingPlayable")}
              className="flex items-center gap-2.5 rounded-lg bg-white px-7 py-3 text-[15px] font-extrabold text-on-accent transition hover:bg-[#d9f7fb] disabled:opacity-50"
            >
              <Play className="size-5 fill-current" />
              {t("playAll")}
            </button>
            {canManage && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t("rename")}
                title={t("rename")}
                className="flex size-[46px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
              >
                <Pencil className="size-5" />
              </button>
            )}
            {isPlaylist && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                aria-label={t("shareTitle")}
                title={t("shareTitle")}
                className="flex size-[46px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-white"
              >
                <Share2 className="size-5" />
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label={t("deleteList")}
                title={t("deleteList")}
                className="flex size-[46px] items-center justify-center rounded-lg border-[1.5px] border-bright/40 bg-white/[0.12] text-white transition hover:border-danger-soft hover:text-danger-soft"
              >
                <Trash2 className="size-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="px-10 pt-8 pb-16">
        {query.isLoading ? (
          <ListSkeleton
            count={8}
            thumb="aspect-[2/3] w-[52px] rounded-md"
            className="flex flex-col divide-y divide-border"
          />
        ) : items.length ? (
          <div className="flex flex-col divide-y divide-border">
            {items.map((entry, index) => (
              <MemberRow
                key={entry.PlaylistItemId ?? entry.Id}
                entry={entry}
                index={index}
                total={items.length}
                isPlaylist={isPlaylist}
                busy={removing || move.isPending}
                onOpen={() => router.push(`/item/${entry.Id}`)}
                onPlay={() => entry.Id && router.push(`/watch/${entry.Id}`)}
                onRemove={() => removeItem(entry)}
                onMoveUp={() => moveItem(index, -1)}
                onMoveDown={() => moveItem(index, 1)}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Plus className="mx-auto mb-3 size-8 text-dim" />
            <p className="text-muted">{t("empty")}</p>
            <p className="mt-1 text-[13px] text-dim">{t("emptyHint")}</p>
          </div>
        )}
      </div>

      {sharing && (
        <PlaylistShareModal
          playlistId={id}
          playlistName={item.Name ?? ""}
          onClose={() => setSharing(false)}
        />
      )}

      {confirmDelete && (
        <Portal>
          <div
            className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setConfirmDelete(false)}
          >
            <div
              className="animate-jn-pop w-full max-w-[420px] rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-danger/15 text-danger-soft">
                  <Trash2 className="size-5" />
                </span>
                <h3 className="text-lg font-extrabold">{t("deleteList")}</h3>
              </div>
              <p className="mb-5 text-[14px] leading-relaxed text-para">
                {t("deleteConfirm", { name: item.Name ?? "" })}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-[10px] border border-border-strong px-4 py-2.5 text-[13px] font-bold text-muted hover:bg-white/[0.06]"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    item.Id &&
                    deleteItem.mutate(item.Id, {
                      onSuccess: () => router.back(),
                    })
                  }
                  disabled={deleteItem.isPending}
                  className="flex items-center gap-1.5 rounded-[10px] bg-danger px-5 py-2.5 text-[13px] font-extrabold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {deleteItem.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {t("deleteList")}
                </button>
              </div>
              {/* The hero's alert is behind this dialog's own backdrop, so a
                  refused delete looked like nothing happened at all. */}
              <div className="mt-3 flex justify-end">
                <InlineError show={deleteItem.isError} />
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function MemberRow({
  entry,
  index,
  total,
  isPlaylist,
  busy,
  onOpen,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: BaseItemDto;
  index: number;
  total: number;
  isPlaylist: boolean;
  busy: boolean;
  onOpen: () => void;
  onPlay: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const t = useTranslations("Collection");
  const img = posterUrl(entry, { maxWidth: 120 });
  const meta = [
    entry.ProductionYear?.toString(),
    entry.OfficialRating ?? undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group flex items-center gap-4 py-3">
      {isPlaylist && (
        <span className="w-6 flex-none text-center text-[15px] font-bold text-dim tabular-nums">
          {index + 1}
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[2/3] w-[52px] flex-none overflow-hidden rounded-md"
        aria-label={entry.Name ?? ""}
      >
        <Art as="span" src={img} seed={entry.Id} className="absolute inset-0" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-[15px] font-bold group-hover:text-accent">
          {entry.Name}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">
          {[entry.Type, meta].filter(Boolean).join(" · ")}
        </div>
      </button>

      {/* jn-hover-reveal rather than a bare hover: it also reveals on keyboard
          focus, so tabbing no longer lands on invisible move/play/remove. */}
      <div className="jn-hover-reveal flex items-center gap-1 transition-opacity">
        {isPlaylist && (
          <>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0 || busy}
              aria-label={t("moveUp")}
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-bright disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1 || busy}
              aria-label={t("moveDown")}
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-bright disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onPlay}
          aria-label={t("play")}
          className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-bright"
        >
          <Play className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={t("remove")}
          className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-danger/20 hover:text-danger-soft disabled:opacity-40"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
