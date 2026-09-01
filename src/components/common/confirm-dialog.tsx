"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Portal } from "./portal";
import { cn } from "@/lib/utils";

/**
 * The one confirmation dialog for actions that destroy something.
 *
 * Several destructive actions were a single unguarded click — delete a library,
 * delete a user, uninstall a plugin, revoke an API key — while the *same*
 * actions elsewhere in the app were confirmed. This is the shared answer, so a
 * new destructive control has an obvious right way to be written.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  icon,
  onCancel,
  onConfirm,
}: {
  title: string;
  /** Say what is about to be destroyed, by name — "are you sure?" is not enough. */
  body: string;
  confirmLabel: string;
  pending?: boolean;
  icon?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Common");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        className="animate-jn-fade fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <div
          className="animate-jn-pop w-full max-w-[420px] rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-danger/15 text-danger-soft">
              {icon ?? <AlertTriangle className="size-5" />}
            </span>
            <h3 className="text-lg font-extrabold">{title}</h3>
          </div>
          <p className="mb-5 text-[14px] leading-relaxed text-para">{body}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[10px] border border-border-strong px-4 py-2.5 text-[13px] font-bold text-muted hover:bg-white/[0.06]"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={cn(
                "flex items-center gap-1.5 rounded-[10px] bg-danger px-5 py-2.5 text-[13px] font-extrabold text-white transition-[filter] hover:brightness-110 disabled:opacity-50",
              )}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
