"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { PickerOption } from "@/lib/jellyfin/tracks";
import { cn } from "@/lib/utils";

interface TrackPickerProps {
  icon: ReactNode;
  /** Current option value; "" selects the empty option. */
  value: string;
  options: PickerOption[];
  /** Label for the "" option (e.g. "Off" for subtitles, "Auto" for audio). */
  emptyLabel: string;
  onChange: (value: string) => void;
  searchPlaceholder: string;
  noMatchesLabel: string;
  /** Stretch to fill its container (for stacked, right-hand panels). */
  block?: boolean;
}

/** Compact dropdown with search — used to pre-pick audio track / subtitle. */
export function TrackPicker({
  icon,
  value,
  options,
  emptyLabel,
  onChange,
  searchPlaceholder,
  noMatchesLabel,
  block,
}: TrackPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currentLabel = value
    ? (options.find((o) => o.value === value)?.label ?? emptyLabel)
    : emptyLabel;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;
  const searchable = options.length > 8;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={cn("relative", block && "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border-strong bg-white/[0.05] px-3.5 py-2.5 text-[13.5px] font-semibold text-bright transition-colors hover:bg-white/[0.09]",
          block && "w-full",
          open && "border-accent",
        )}
      >
        <span className="text-muted">{icon}</span>
        <span
          className={cn(
            "truncate",
            block ? "flex-1 text-left" : "max-w-[160px]",
          )}
        >
          {currentLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-4 flex-none text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="animate-jn-pop absolute bottom-full left-0 z-30 mb-2 w-[288px] rounded-2xl border border-border-strong bg-bg/98 p-2.5 shadow-2xl backdrop-blur-md">
            {searchable && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  className="h-9 w-full rounded-lg border border-border-strong bg-white/[0.05] pr-3 pl-9 text-[13px] text-text outline-none focus:border-accent"
                />
              </div>
            )}
            <div className="max-h-[46vh] overflow-y-auto">
              <Row
                label={emptyLabel}
                on={value === ""}
                onClick={() => choose("")}
              />
              {filtered.map((o) => (
                <Row
                  key={o.value}
                  label={o.label}
                  on={value === o.value}
                  onClick={() => choose(o.value)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="px-2 py-5 text-center text-[12.5px] text-muted">
                  {noMatchesLabel}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        on ? "bg-accent/15" : "hover:bg-white/[0.06]",
      )}
    >
      <Check
        className={cn(
          "size-4 flex-none text-accent",
          on ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex-1 truncate text-[13px] font-semibold",
          on ? "text-accent" : "text-text",
        )}
      >
        {label}
      </span>
    </button>
  );
}
