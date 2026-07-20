"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Settings } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { LanguageToggle } from "@/components/common/language-toggle";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useMe } from "@/lib/jellyfin/queries";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

export function TopNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const me = useMe();
  const [scrolled, setScrolled] = useState(false);
  // Discover is TMDb-powered — hide it entirely when no key is configured.
  const navItems = NAV_ITEMS.filter(
    (item) => item.key !== "discover" || user.tmdbEnabled,
  );

  // Transparent over the page top (so heroes bleed under it), frosted once
  // the user scrolls. rAF defers the initial sync out of the effect body.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    const raf = requestAnimationFrame(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 flex-none">
      {/* Frosted glass fades in once scrolled; transparent at the page top. */}
      <div
        className={cn(
          "absolute inset-0 border-b bg-nav/70 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300",
          scrolled
            ? "border-border opacity-100"
            : "border-transparent opacity-0",
        )}
      />

      <div className="relative z-10 flex h-full items-center gap-5 px-8">
        <Link href="/home" className="flex-none">
          <Logo size={36} wordmarkSize={21} />
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
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

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="flex size-[38px] items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
            aria-label={t("search")}
          >
            <Search className="size-[19px]" />
          </button>

          <LanguageToggle />

          <NotificationsMenu />

          <Link
            href="/admin"
            className="flex size-[38px] items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
            aria-label="Settings"
          >
            <Settings className="size-[19px]" />
          </Link>

          <Link href="/prefs" className="flex-none" aria-label={user.userName}>
            <Avatar
              userId={user.userId}
              imageTag={me.data?.PrimaryImageTag}
              name={user.userName}
              size={34}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
