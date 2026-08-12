import { redirect } from "next/navigation";
import { getSession } from "@/lib/jellyfin/session";

// Entry: send authenticated users into the app, everyone else to login.
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? "/home" : "/login");
}
