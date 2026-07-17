import { Hammer } from "lucide-react";

/** Placeholder for screens landing in later build steps. */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-muted">
        <Hammer className="size-6" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {note && <p className="max-w-md text-sm text-muted">{note}</p>}
    </div>
  );
}
