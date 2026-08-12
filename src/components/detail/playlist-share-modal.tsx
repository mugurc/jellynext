"use client";

import { useTranslations } from "next-intl";
import { Globe, Loader2, Lock } from "lucide-react";
import { Portal } from "@/components/common/portal";
import { Avatar } from "@/components/common/avatar";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useServerUsers } from "@/lib/jellyfin/admin-queries";
import {
  usePlaylist,
  usePlaylistUsers,
  useRemovePlaylistUser,
  useSetPlaylistUser,
  useUpdatePlaylist,
} from "@/lib/jellyfin/queries";
import { cn } from "@/lib/utils";

/** Manage a playlist's visibility (public/private) and per-user sharing. */
export function PlaylistShareModal({
  playlistId,
  playlistName,
  onClose,
}: {
  playlistId: string;
  playlistName: string;
  onClose: () => void;
}) {
  const t = useTranslations("Collection");
  const { userId } = useCurrentUser();
  const detail = usePlaylist(playlistId);
  const shares = usePlaylistUsers(playlistId);
  const users = useServerUsers();
  const updatePlaylist = useUpdatePlaylist();
  const setUser = useSetPlaylistUser();
  const removeUser = useRemovePlaylistUser();

  const isPublic = detail.data?.OpenAccess ?? false;
  const shareMap = new Map(
    (shares.data ?? []).map((s) => [s.UserId, s.CanEdit ?? false]),
  );
  const others = (users.data ?? []).filter((u) => u.Id && u.Id !== userId);

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="animate-jn-pop max-h-[85vh] w-full max-w-[460px] overflow-y-auto rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-1 text-lg font-extrabold">{t("shareTitle")}</h3>
          <p className="mb-5 truncate text-[13px] text-muted">{playlistName}</p>

          {/* Public / private */}
          <button
            type="button"
            onClick={() =>
              updatePlaylist.mutate({
                playlistId,
                body: { Name: playlistName, IsPublic: !isPublic },
              })
            }
            className="mb-5 flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-colors hover:border-accent/50"
          >
            <span
              className={cn(
                "flex size-9 flex-none items-center justify-center rounded-lg",
                isPublic
                  ? "bg-accent/15 text-accent"
                  : "bg-white/[0.06] text-muted",
              )}
            >
              {isPublic ? (
                <Globe className="size-4.5" />
              ) : (
                <Lock className="size-4.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold">
                {isPublic ? t("public") : t("private")}
              </div>
              <div className="text-[12px] text-muted">
                {isPublic ? t("publicDesc") : t("privateDesc")}
              </div>
            </div>
            {updatePlaylist.isPending && (
              <Loader2 className="size-4 flex-none animate-spin text-dim" />
            )}
          </button>

          {/* Per-user sharing */}
          <div className="mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">
            {t("sharedWith")}
          </div>
          {users.isLoading ? (
            <div className="py-8 text-center text-dim">
              <Loader2 className="mx-auto size-5 animate-spin" />
            </div>
          ) : others.length ? (
            <div className="flex flex-col gap-1">
              {others.map((u) => {
                const shared = shareMap.has(u.Id!);
                const canEdit = shareMap.get(u.Id!) ?? false;
                return (
                  <div
                    key={u.Id}
                    className="flex items-center gap-3 rounded-lg px-1.5 py-2"
                  >
                    <Avatar
                      userId={u.Id}
                      imageTag={u.PrimaryImageTag}
                      name={u.Name}
                      size={34}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">
                        {u.Name}
                      </div>
                      {shared && (
                        <button
                          type="button"
                          onClick={() =>
                            setUser.mutate({
                              playlistId,
                              userId: u.Id!,
                              canEdit: !canEdit,
                            })
                          }
                          className="text-[11.5px] text-accent hover:underline"
                        >
                          {canEdit ? t("canEdit") : t("canView")}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        shared
                          ? removeUser.mutate({ playlistId, userId: u.Id! })
                          : setUser.mutate({
                              playlistId,
                              userId: u.Id!,
                              canEdit: false,
                            })
                      }
                      className={cn(
                        "flex-none rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors",
                        shared
                          ? "bg-white/[0.08] text-muted hover:bg-white/[0.14]"
                          : "bg-accent/15 text-accent hover:bg-accent/25",
                      )}
                    >
                      {shared ? t("unshare") : t("share")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-[13px] text-dim">{t("noOtherUsers")}</p>
          )}
        </div>
      </div>
    </Portal>
  );
}
