"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/common/portal";

/** Extract an 11-char YouTube video id from watch/short/embed URLs. */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function TrailerModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const id = youtubeId(url);

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-5" />
        </button>

        <div
          className="animate-jn-pop w-full max-w-[min(92vw,1080px)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl">
            {id ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
                title={title ?? "Trailer"}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full items-center justify-center text-sm font-semibold text-accent underline"
              >
                {url}
              </a>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
