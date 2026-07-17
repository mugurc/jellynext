import { LoginView, type PublicUser } from "@/components/auth/login-view";
import {
  getPublicUsers,
  getServerInfo,
  isQuickConnectEnabled,
} from "@/lib/jellyfin/auth-actions";
import { getActiveServerUrl } from "@/lib/jellyfin/session";

export default async function LoginPage() {
  const serverUrl = await getActiveServerUrl();
  const [info, users, quickConnectEnabled] = await Promise.all([
    getServerInfo(serverUrl),
    getPublicUsers(),
    isQuickConnectEnabled(),
  ]);

  const publicUsers: PublicUser[] = users
    .filter((u) => u.Id)
    .map((u) => ({
      id: u.Id!,
      name: u.Name ?? "",
      hasPassword: Boolean(u.HasPassword),
    }));

  return (
    <LoginView
      serverName={info.ok ? (info.info.ServerName ?? serverUrl) : serverUrl}
      serverUrl={serverUrl}
      serverReachable={info.ok}
      publicUsers={publicUsers}
      quickConnectEnabled={quickConnectEnabled}
    />
  );
}
