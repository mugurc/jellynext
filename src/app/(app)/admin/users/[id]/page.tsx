import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";
import { UserDetailView } from "@/components/admin/user-detail-view";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/home");
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
