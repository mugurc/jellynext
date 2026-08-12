"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A single row inside a dropdown menu: leading icon plus label. */
export function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
        danger
          ? "text-danger-soft hover:bg-danger/10"
          : "text-text hover:bg-white/[0.06]",
      )}
    >
      <span className={danger ? "text-danger-soft" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}

/** Shared surface styling for dropdown menus. */
export const MENU_SURFACE =
  "animate-jn-pop overflow-hidden rounded-xl border border-border-strong bg-bg/95 p-1.5 shadow-2xl backdrop-blur-md";
