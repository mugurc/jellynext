import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";
import { LibraryDetailView } from "@/components/admin/library-detail-view";

export default async function AdminLibraryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/home");
  const { name } = await params;
  return <LibraryDetailView name={decodeURIComponent(name)} />;
}
