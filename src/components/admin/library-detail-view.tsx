"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  FolderTree,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  useAddLibraryPath,
  useLibraries,
  useRemoveLibrary,
  useRemoveLibraryPath,
  useRenameLibrary,
  useScanLibrary,
} from "@/lib/jellyfin/admin-queries";
import { FolderPicker } from "./folder-picker";
import { cn } from "@/lib/utils";

export function LibraryDetailView({ name }: { name: string }) {
  const t = useTranslations("LibraryEdit");
  const router = useRouter();
  const { data, isLoading } = useLibraries();
  const lib = (data ?? []).find((l) => l.Name === name);

  const rename = useRenameLibrary();
  const addPath = useAddLibraryPath();
  const removePath = useRemoveLibraryPath();
  const scan = useScanLibrary();
  const del = useRemoveLibrary();

  const [newName, setNewName] = useState(name);
  const [syncedName, setSyncedName] = useState(name);
  const [addOpen, setAddOpen] = useState(false);
  const [path, setPath] = useState("");

  if (syncedName !== name) {
    setSyncedName(name);
    setNewName(name);
  }

  if (isLoading) {
    return (
      <div className="px-10 pt-8 pb-16">
        <div className="h-8 w-48 animate-pulse rounded bg-card/60" />
        <div className="mt-6 h-48 animate-pulse rounded-2xl bg-card/40" />
      </div>
    );
  }

  if (!lib) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted">{t("notFound")}</p>
        <Link
          href="/admin"
          className="rounded-lg border border-border-strong px-4 py-2 text-sm font-bold text-bright hover:bg-white/[0.06]"
        >
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 pt-8 pb-24">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="flex size-9 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-muted transition-colors hover:bg-white/[0.12] hover:text-text"
          aria-label={t("back")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <FolderTree className="size-6 flex-none text-accent" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {lib.Name}
          </h1>
          <div className="text-[12.5px] text-muted capitalize">
            {lib.CollectionType ?? "mixed"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => lib.ItemId && scan.mutate(lib.ItemId)}
            disabled={scan.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            {scan.isSuccess ? (
              <Check className="size-4 text-emerald-400" />
            ) : (
              <RefreshCw
                className={cn("size-4", scan.isPending && "animate-spin")}
              />
            )}
            {t("scan")}
          </button>
          <button
            type="button"
            onClick={() =>
              lib.Name &&
              del.mutate(lib.Name, { onSuccess: () => router.push("/admin") })
            }
            className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-danger-soft transition-colors hover:bg-danger-soft/10"
          >
            <Trash2 className="size-4" /> {t("delete")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Rename */}
        <Section title={t("rename")}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                {t("libraryName")}
              </span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 text-[14px] text-text outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                newName.trim() &&
                newName.trim() !== name &&
                rename.mutate(
                  { name, newName: newName.trim() },
                  {
                    onSuccess: () =>
                      router.replace(
                        `/admin/libraries/${encodeURIComponent(newName.trim())}`,
                      ),
                  },
                )
              }
              disabled={
                !newName.trim() || newName.trim() === name || rename.isPending
              }
              className="flex h-11 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {rename.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("renameAction")}
            </button>
          </div>
        </Section>

        {/* Paths */}
        <Section title={t("paths")}>
          <div className="flex flex-col gap-2">
            {(lib.Locations ?? []).map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-bright">
                  {p}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    lib.Name && removePath.mutate({ name: lib.Name, path: p })
                  }
                  disabled={removePath.isPending}
                  aria-label={t("remove")}
                  className="flex size-7 flex-none items-center justify-center rounded-md text-dim transition-colors hover:bg-danger-soft/15 hover:text-danger-soft disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {addOpen ? (
            <div className="mt-3 flex flex-col gap-2.5">
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/media/data/movies"
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 font-mono text-[13px] text-text outline-none focus:border-accent"
              />
              <FolderPicker value={path} onChange={setPath} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    lib.Name &&
                    path.trim() &&
                    addPath.mutate(
                      { name: lib.Name, path: path.trim() },
                      {
                        onSuccess: () => {
                          setPath("");
                          setAddOpen(false);
                        },
                      },
                    )
                  }
                  disabled={!path.trim() || addPath.isPending}
                  className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
                >
                  {addPath.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {t("add")}
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="h-10 rounded-[10px] border border-border-strong px-4 text-[13px] font-bold text-muted hover:bg-white/[0.06]"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06]"
            >
              <Plus className="size-4" /> {t("addPath")}
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-[13px] font-extrabold tracking-[0.08em] text-accent">
        {title}
      </h3>
      {children}
    </div>
  );
}
