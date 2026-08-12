import { userImageUrl } from "@/lib/jellyfin/browser";
import { cn } from "@/lib/utils";

/** Deterministic hue (0–359) from a string, so a name always maps to a color. */
function hueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash * 31 + str.charCodeAt(i)) % 360;
  return hash;
}

/**
 * The default (image-less) avatar look: a gradient tinted per identity so each
 * user gets a distinct, stable colour instead of the same flat fill.
 */
export function avatarGradient(seed?: string | null): string {
  const h = hueFromString(seed || "?");
  return `linear-gradient(140deg, oklch(0.66 0.15 ${h}), oklch(0.45 0.14 ${(h + 45) % 360}))`;
}

/**
 * Unified user avatar used everywhere (header, prefs, admin, sessions).
 * Renders the uploaded Jellyfin avatar when an image tag is available,
 * otherwise a per-user coloured gradient tile with the initial.
 */
export function Avatar({
  userId,
  imageTag,
  name,
  size = 34,
  className,
}: {
  userId?: string | null;
  imageTag?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const img =
    userId && imageTag ? userImageUrl(userId, imageTag, size * 2) : null;

  return (
    <span
      aria-label={name || undefined}
      className={cn(
        "flex flex-none items-center justify-center overflow-hidden rounded-lg bg-cover bg-center font-bold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        ...(img
          ? { backgroundImage: `url("${img}")` }
          : { background: avatarGradient(name || userId) }),
      }}
    >
      {!img && initial}
    </span>
  );
}
