import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopNav } from "@/components/shell/top-nav";
import { CurrentUserProvider } from "@/lib/auth/current-user";
import { getSession } from "@/lib/jellyfin/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CurrentUserProvider
      user={{
        userId: session.userId,
        userName: session.userName,
        isAdmin: session.isAdmin,
        serverUrl: session.serverUrl,
      }}
    >
      <div className="flex min-h-dvh flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
      </div>
    </CurrentUserProvider>
  );
}
