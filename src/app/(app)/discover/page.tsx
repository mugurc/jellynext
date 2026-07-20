import { redirect } from "next/navigation";
import { DiscoverView } from "@/components/tmdb/discover-view";

export default function DiscoverPage() {
  // Discover is powered by TMDb; without a key there's nothing to show.
  if (!process.env.TMDB_API_KEY) redirect("/home");
  return <DiscoverView />;
}
