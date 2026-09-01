"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Loading, failed and empty are three different facts.
 *
 * The app used to collapse all three into "there is nothing here": an admin
 * with ten libraries was told they had none while the request was in flight,
 * and a 403 on the activity log read as a quiet, factual emptiness. Render this
 * in place of a bare empty-state string — it distinguishes the three, and gives
 * a failure somewhere to go.
 */
export function QueryState({
  isLoading,
  isError,
  isEmpty,
  emptyText,
  skeleton,
  onRetry,
}: {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyText: string;
  /** Preferred over the spinner wherever the shape of the result is known. */
  skeleton?: React.ReactNode;
  onRetry?: () => void;
}) {
  const t = useTranslations("Common");

  if (isLoading) {
    return (
      skeleton ?? (
        <div className="flex justify-center py-10 text-dim">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 py-10 text-center"
      >
        <AlertTriangle className="size-6 text-danger-soft" />
        <p className="text-[13px] text-muted">{t("loadFailed")}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-border-strong px-4 py-2 text-[12.5px] font-bold text-bright transition-colors hover:bg-white/[0.06]"
          >
            {t("retry")}
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <p className="py-10 text-center text-[13px] text-muted">{emptyText}</p>
    );
  }

  return null;
}

/**
 * A failed action, said out loud next to the control that failed.
 *
 * Most admin mutations reported nothing at all: the spinner stopped, the form
 * stayed open, and success and failure looked identical — so an admin who had
 * just added an unreadable media path closed the dialog believing it saved.
 */
export function InlineError({
  show,
  message,
}: {
  show?: boolean;
  message?: string;
}) {
  const t = useTranslations("Common");
  if (!show) return null;
  return (
    <span
      role="alert"
      className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-soft"
    >
      <AlertTriangle className="size-4 flex-none" />
      {message ?? t("actionFailed")}
    </span>
  );
}
