import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TopNav } from "@/components/shell/top-nav";
import { NowPlayingBar } from "@/components/player/now-playing-bar";
import { RealtimeMessages } from "@/components/shell/realtime-messages";
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
        deviceId: session.deviceId,
        tmdbEnabled: Boolean(process.env.TMDB_API_KEY),
      }}
    >
      <div className="flex min-h-dvh flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
        <NowPlayingBar />
        <RealtimeMessages />
      </div>
    </CurrentUserProvider>
  );
}
