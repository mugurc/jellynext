"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Search, Settings } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/common/language-toggle";
import { useCurrentUser } from "@/lib/auth/current-user";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

export function TopNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const initial = (user.userName || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-5 border-b border-border bg-nav/80 px-8 backdrop-blur-md">
      <Link href="/home" className="flex-none">
        <Logo size={36} wordmarkSize={21} />
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "text-text" : "text-muted hover:text-text",
              )}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="flex h-[38px] max-w-[240px] min-w-11 flex-1 cursor-text items-center gap-2.5 rounded-[10px] border border-border-strong bg-white/[0.05] px-3.5 text-left"
          aria-label={t("search")}
        >
          <Search className="size-[17px] flex-none text-dim" />
          <span className="truncate text-sm text-dim">{t("search")}</span>
        </button>

        <LanguageToggle />

        <button
          type="button"
          className="relative flex size-[38px] items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
          aria-label="Notifications"
        >
          <Bell className="size-[19px]" />
          <span className="absolute top-2 right-[9px] size-1.5 rounded-full bg-accent" />
        </button>

        <Link
          href="/admin"
          className="flex size-[38px] items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
          aria-label="Settings"
        >
          <Settings className="size-[19px]" />
        </Link>

        <Link
          href="/prefs"
          className="flex size-[34px] flex-none items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{
            background: "radial-gradient(circle at 35% 30%, #2bd4c6, #157a9e)",
          }}
          aria-label={user.userName}
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
