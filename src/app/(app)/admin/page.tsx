import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/home");
  return (
    <ComingSoon
      title="Server Dashboard"
      note="The full admin dashboard (Overview, Libraries, Users, Devices, Plugins, Tasks, Logs, and more) arrives in step 5."
    />
  );
}
