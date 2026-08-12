import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/home");
  return <AdminView />;
}
