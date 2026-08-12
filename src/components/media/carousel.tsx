"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarouselProps {
  title: string;
  seeAllHref?: string;
  children: ReactNode;
  className?: string;
}

export function Carousel({
  title,
  seeAllHref,
  children,
  className,
}: CarouselProps) {
  const t = useTranslations("Common");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // A couple of pixels of slack: cards land on fractional widths, so
    // scrollLeft rarely reaches exactly 0 or exactly the maximum.
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // A narrower window can turn a row that fitted into one that scrolls.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  // Both ends reachable at once means the row fits and there is nothing to page.
  const scrollable = !(atStart && atEnd);

  return (
    <section className={cn("mb-9", className)}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>

        <div className="ml-auto flex items-center gap-2.5">
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="flex items-center gap-0.5 text-[12.5px] font-semibold text-accent"
            >
              {t("seeAll")}
              <ChevronRight className="size-4" />
            </Link>
          )}
          {scrollable && (
            <div className="jn-row-arrows flex items-center gap-1.5">
              <RowArrow
                side="left"
                label={t("previous")}
                disabled={atStart}
                onClick={() => scrollBy(-1)}
              />
              <RowArrow
                side="right"
                label={t("next")}
                disabled={atEnd}
                onClick={() => scrollBy(1)}
              />
            </div>
          )}
        </div>
      </div>

      {/* `overflow-x-auto` makes the vertical axis compute to `auto` too, so the
          padding is what keeps the cards' hover lift and ring from being
          clipped. gap matches the grids elsewhere. */}
      <div
        ref={scrollerRef}
        className="jn-stagger no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pt-1.5 pb-2"
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Paging control for a row. Lives in the header rather than floating over the
 * track: overlaid arrows hide the artwork of whichever card sits under them, and
 * they cannot show whether there is anything left to scroll to.
 */
function RowArrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-border bg-surface/70 text-text transition-colors duration-150 hover:border-border-strong hover:bg-surface disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="size-4" />
    </button>
  );
}
