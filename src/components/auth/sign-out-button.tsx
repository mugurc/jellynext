"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/jellyfin/auth-actions";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await logout();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isPending}
      className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-border-strong px-5 py-3 text-sm font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-60"
    >
      <LogOut className="size-[1.1em]" /> {t("signOut")}
    </button>
  );
}
