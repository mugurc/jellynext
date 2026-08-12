import Link from "next/link";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { gradientFallback, posterUrl } from "@/lib/jellyfin/media";
import { cn } from "@/lib/utils";

/** Square album tile → album detail. */
export function AlbumCard({
  album,
  className,
}: {
  album: BaseItemDto;
  className?: string;
}) {
  const img = posterUrl(album, { maxWidth: 340 });
  const subtitle = [
    album.AlbumArtist ?? album.Artists?.[0],
    album.ProductionYear,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/item/${album.Id}`}
      className={cn(
        "group block transition-transform hover:-translate-y-1",
        className,
      )}
    >
      <div
        className="mb-2.5 aspect-square rounded-xl bg-cover bg-center shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(album.Id)}`
            : gradientFallback(album.Id),
        }}
      />
      <div className="truncate text-[13.5px] font-bold">{album.Name}</div>
      <div className="truncate text-[11.5px] text-muted">{subtitle}</div>
    </Link>
  );
}

/** Circular artist tile → artist detail. */
export function ArtistAvatar({
  artist,
  label,
}: {
  artist: BaseItemDto;
  label?: string;
}) {
  const img = posterUrl(artist, { maxWidth: 240 });
  return (
    <Link
      href={`/item/${artist.Id}`}
      className="group flex w-[120px] flex-none flex-col items-center gap-2.5 text-center transition-transform hover:-translate-y-1"
    >
      <span
        className="size-[120px] rounded-full bg-cover bg-center ring-2 ring-transparent transition-[box-shadow] group-hover:ring-accent"
        style={{
          backgroundImage: img
            ? `url("${img}"), ${gradientFallback(artist.Id)}`
            : gradientFallback(artist.Id),
        }}
      />
      <div className="w-full">
        <div className="truncate text-[13px] font-bold">{artist.Name}</div>
        {label && <div className="text-[11px] text-muted">{label}</div>}
      </div>
    </Link>
  );
}
