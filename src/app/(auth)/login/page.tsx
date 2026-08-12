import { LoginView, type PublicUser } from "@/components/auth/login-view";
import {
  getPublicUsers,
  getServerInfo,
  isQuickConnectEnabled,
} from "@/lib/jellyfin/auth-actions";
import { getActiveServerUrl } from "@/lib/jellyfin/session";

export default async function LoginPage() {
  const serverUrl = await getActiveServerUrl();
  // Resolve the origin first: a configured address without a scheme may only
  // answer over http, and everything below has to hit the same host.
  const info = await getServerInfo(serverUrl);
  const resolvedUrl = info.ok ? info.serverUrl : serverUrl;

  const [users, quickConnectEnabled] = await Promise.all([
    getPublicUsers(resolvedUrl),
    isQuickConnectEnabled(resolvedUrl),
  ]);

  const publicUsers: PublicUser[] = users
    .filter((u) => u.Id)
    .map((u) => ({
      id: u.Id!,
      name: u.Name ?? "",
      hasPassword: Boolean(u.HasPassword),
      // Jellyfin serves user images anonymously, so the profile picker can show
      // real avatars before anyone has signed in. Straight from the server —
      // the /api/jf proxy needs a session we don't have yet.
      imageUrl: u.PrimaryImageTag
        ? `${resolvedUrl}/Users/${u.Id}/Images/Primary?tag=${encodeURIComponent(
            u.PrimaryImageTag,
          )}&maxWidth=200&quality=90`
        : null,
    }));

  return (
    <LoginView
      serverName={info.ok ? (info.info.ServerName ?? resolvedUrl) : serverUrl}
      serverUrl={resolvedUrl}
      serverReachable={info.ok}
      publicUsers={publicUsers}
      quickConnectEnabled={quickConnectEnabled}
    />
  );
}
