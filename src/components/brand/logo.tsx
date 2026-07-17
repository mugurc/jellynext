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

/** JellyNext brand lockup: jellyfish monogram mark + "Jelly" + accent "Next". */
export function Logo({
  size = 36,
  wordmarkSize,
  markOnly = false,
  className,
}: LogoProps) {
  const fontSize = wordmarkSize ?? Math.round(size * 0.58);
  return (
    <div className={cn("flex items-center gap-[0.3em]", className)}>
      <Image
        src="/logo-mark.svg"
        alt="JellyNext"
        width={size}
        height={size}
        priority
        className="flex-none object-contain"
        style={{ width: size, height: size }}
      />
      {!markOnly && (
        <span
          className="font-extrabold tracking-[-0.02em] text-text"
          style={{ fontSize }}
        >
          Jelly<span className="text-accent">Next</span>
        </span>
      )}
    </div>
  );
}
