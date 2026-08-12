"use client";

import { useTranslations } from "next-intl";
import { ArrowUp, Folder } from "lucide-react";
import { useDirectoryContents, useDrives } from "@/lib/jellyfin/admin-queries";
import { cn } from "@/lib/utils";

export function parentPath(p: string): string {
  if (!p || p === "/") return "/";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

/** Browse the Jellyfin server's file system; the current directory is the
 *  selected path (drives jump to a root, folders navigate in, ⬆ goes up). */
export function FolderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const t = useTranslations("Admin");
  const path = value || "/";
  const drives = useDrives();
  const contents = useDirectoryContents(path);
  const dirs = (contents.data ?? []).filter(
    (e) => String(e.Type) === "Directory" || String(e.Type) === "Folder",
  );

  return (
    <div className="overflow-hidden rounded-[10px] border border-border-strong bg-white/[0.02]">
      {(drives.data ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
          {(drives.data ?? []).map((d) => (
            <button
              key={d.Path}
              type="button"
              onClick={() => d.Path && onChange(d.Path)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11.5px] font-semibold transition-colors",
                value === d.Path
                  ? "bg-accent text-on-accent"
                  : "bg-white/[0.06] text-bright hover:bg-white/[0.1]",
              )}
            >
              {d.Name || d.Path}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(parentPath(path))}
          disabled={path === "/"}
          aria-label="Up"
          className="flex size-7 flex-none items-center justify-center rounded-md text-muted transition-colors hover:bg-white/[0.06] hover:text-text disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-bright">
          {path}
        </span>
      </div>
      <div className="max-h-[220px] overflow-y-auto p-1.5">
        {contents.isLoading ? (
          <div className="px-2 py-5 text-center text-[12px] text-muted">…</div>
        ) : contents.isError ? (
          <div className="px-2 py-5 text-center text-[12px] text-danger-soft">
            {t("folderUnreadable")}
          </div>
        ) : dirs.length ? (
          dirs.map((d) => (
            <button
              key={d.Path}
              type="button"
              onClick={() => d.Path && onChange(d.Path)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-white/[0.06]"
            >
              <Folder className="size-4 flex-none text-accent" />
              <span className="truncate">{d.Name}</span>
            </button>
          ))
        ) : (
          <div className="px-2 py-5 text-center text-[12px] text-muted">
            {t("emptyFolder")}
          </div>
        )}
      </div>
    </div>
  );
}
