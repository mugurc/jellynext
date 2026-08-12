"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * An image that stays transparent until it has actually decoded, then fades in.
 * Entry animations that start on mount finish long before large artwork arrives,
 * so hero images have to key off the load event instead.
 */
export function FadeImg({
  src,
  alt,
  className,
  priority,
  lazy,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Above-the-fold artwork: ask the browser to fetch it first. */
  priority?: boolean;
  /** Off-screen artwork (grid and carousel tiles): defer the fetch. */
  lazy?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A cached image can finish before React attaches onLoad, which would
      // leave it stuck at opacity 0 — the ref catches that case.
      ref={(node) => {
        if (node?.complete) setLoaded(true);
      }}
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      decoding="async"
      loading={lazy ? "lazy" : undefined}
      fetchPriority={priority ? "high" : undefined}
      className={cn(
        "jn-img-fade",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
