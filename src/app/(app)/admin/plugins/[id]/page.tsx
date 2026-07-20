import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";
import { PluginDetailView } from "@/components/admin/plugin-detail-view";

export default async function AdminPluginPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/home");
  const { id } = await params;
  return <PluginDetailView id={id} />;
}
