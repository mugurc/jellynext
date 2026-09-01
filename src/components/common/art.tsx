"use client";

import { gradientFallback } from "@/lib/jellyfin/media";
import { FadeImg } from "./fade-img";
import { cn } from "@/lib/utils";

/**
 * The one way artwork enters the UI.
 *
 * Two rules, both learned the hard way:
 *
 * The placeholder gradient is the box's OWN background rather than a child. A
 * background is clipped by the element's border-radius exactly, whereas a child
 * is clipped by the ancestor's overflow, which antialiases and lets whatever
 * sits beneath bleed through the corners.
 *
 * The artwork on top is a real <img>, never a CSS `background-image`. A
 * background has no load event, so it can only ever pop into place; an <img>
 * can wait until it has decoded and fade in over the gradient that was already
 * holding its spot. Anything painted over the artwork comes in as `children`,
 * above the image in the stack.
 */
export function Art({
  src,
  alt = "",
  seed,
  gradient,
  fit = "cover",
  as: Tag = "div",
  className,
  priority,
  lazy = true,
  children,
}: {
  src?: string | null;
  /** Empty by default: most artwork is decorative next to its own caption. */
  alt?: string;
  /** Identity the placeholder gradient is derived from — usually the item id. */
  seed?: string | null;
  /** Replaces the placeholder for palettes of their own (e.g. user avatars). */
  gradient?: string;
  fit?: "cover" | "contain";
  /** `span` for artwork sitting in phrasing content, such as inside a link. */
  as?: "div" | "span";
  className?: string;
  /** On-screen artwork: fetch it first and do not defer it. */
  priority?: boolean;
  /** Off-screen artwork defers its fetch; pass false when it is always visible. */
  lazy?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Tag
      className={cn("relative block overflow-hidden", className)}
      style={{ backgroundImage: gradient ?? gradientFallback(seed) }}
    >
      {src && (
        <FadeImg
          src={src}
          alt={alt}
          priority={priority}
          lazy={lazy && !priority}
          className={cn(
            "absolute inset-0 size-full object-center",
            fit === "contain" ? "object-contain" : "object-cover",
          )}
        />
      )}
      {children}
    </Tag>
  );
}
