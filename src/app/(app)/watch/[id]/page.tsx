import { PlayerView } from "@/components/player/player-view";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `key` makes each item its own component instance. Without it React reuses
  // one instance across /watch/A -> /watch/B, and the refs guarding the
  // Playing/Stopped reports (startedRef, stoppedRef) stay set from the previous
  // episode: the server then never hears that A stopped or that B started, and
  // the progress interval posts B's id with A's position and play session.
  return <PlayerView key={id} itemId={id} />;
}
