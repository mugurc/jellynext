"use client";

import { useRef, type ReactNode } from "react";
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

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className={cn("group/row mb-9", className)}>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="ml-auto flex items-center gap-0.5 text-[12.5px] font-semibold text-accent"
          >
            {t("seeAll")}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-1.5"
        >
          {children}
        </div>

        <CarouselArrow side="left" onClick={() => scrollBy(-1)} />
        <CarouselArrow side="right" onClick={() => scrollBy(1)} />
      </div>
    </section>
  );
}

function CarouselArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side}
      className={cn(
        "absolute top-0 hidden h-[calc(100%-0.375rem)] w-12 items-center justify-center bg-nav/90 text-text opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 hover:bg-nav md:flex",
        side === "left"
          ? "left-0 rounded-r-lg bg-gradient-to-r"
          : "right-0 rounded-l-lg bg-gradient-to-l",
      )}
    >
      <Icon className="size-7" />
    </button>
  );
}
