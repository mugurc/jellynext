import { PlayerView } from "@/components/player/player-view";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerView itemId={id} />;
}
