import { redirect } from "next/navigation";
import { TmdbDetailView } from "@/components/tmdb/tmdb-detail-view";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  if (!process.env.TMDB_API_KEY) redirect("/home");
  const { type, id } = await params;
  return <TmdbDetailView type={type} id={id} />;
}
