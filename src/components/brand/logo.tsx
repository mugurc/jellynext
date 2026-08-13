import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Height of the jellyfish mark in px (wordmark scales alongside). */
  size?: number;
  /** Font size of the wordmark in px. Defaults to a balanced ratio of `size`. */
  wordmarkSize?: number;
  markOnly?: boolean;
  className?: string;
}

/** Intrinsic aspect of logo-mark.svg (viewBox is 236 × 298, not square). */
const MARK_RATIO = 236 / 298;

/** JellyNext brand lockup: jellyfish monogram mark + "Jelly" + accent "Next". */
export function Logo({
  size = 36,
  wordmarkSize,
  markOnly = false,
  className,
}: LogoProps) {
  const fontSize = wordmarkSize ?? Math.round(size * 0.58);
  // The mark is taller than it is wide. Boxing it in a square left ~21% of the
  // width empty, which the gap then added to — so the lockup drifted apart.
  const markWidth = Math.round(size * MARK_RATIO);
  return (
    // `em` here resolves against this element, so the gap only tracks the
    // lockup if the font size lives on the container rather than the wordmark.
    <div
      className={cn("flex items-center gap-[0.3em]", className)}
      style={{ fontSize }}
    >
      <Image
        src="/logo-mark.svg"
        // Decorative beside the wordmark: with both labelled, a screen reader
        // announces "JellyNext" twice. It carries the name only when alone.
        alt={markOnly ? "JellyNext" : ""}
        width={markWidth}
        height={size}
        priority
        className="flex-none"
        style={{ width: markWidth, height: size }}
      />
      {!markOnly && (
        <span className="font-extrabold tracking-[-0.02em] text-text">
          Jelly<span className="text-accent">Next</span>
        </span>
      )}
    </div>
  );
}
