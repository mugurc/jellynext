"use server";

import { cookies } from "next/headers";
import type {
  AuthenticationResult,
  PublicSystemInfo,
  QuickConnectResult,
  UserDto,
} from "@jellyfin/sdk/lib/generated-client";
import { QUICK_CONNECT_COOKIE } from "./constants";
import { jfFetch, jfJson } from "./rest";
import {
  clearSession,
  getActiveServerUrl,
  getSession,
  setActiveServerUrl,
  setSession,
  type JnSession,
} from "./session";

function trimUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Candidate origins to try for a typed address, most likely first.
 *
 * An explicit scheme is respected as-is. Without one we try https and then
 * http: a self-hosted Jellyfin on the LAN (`192.168.1.5:8096`, `nas.local`)
 * usually has no certificate, and https-only would report it as unreachable
 * even though the server is right there.
 */
function candidateUrls(url: string): string[] {
  const u = trimUrl(url);
  if (!u) return [];
  if (/^https?:\/\//i.test(u)) return [u];
  return [`https://${u}`, `http://${u}`];
}

/** Run `attempt` against each candidate origin until one answers. */
async function firstReachable<T>(
  raw: string,
  attempt: (serverUrl: string) => Promise<T>,
): Promise<T | null> {
  for (const url of candidateUrls(raw)) {
    try {
      return await attempt(url);
    } catch {
      // Unreachable over this scheme — fall through to the next candidate.
    }
  }
  return null;
}

async function sessionFromResult(
  serverUrl: string,
  deviceId: string,
  result: AuthenticationResult,
): Promise<void> {
  if (!result.AccessToken || !result.User?.Id) {
    throw new Error("Missing token in authentication result");
  }
  const session: JnSession = {
    serverUrl,
    token: result.AccessToken,
    userId: result.User.Id,
    userName: result.User.Name ?? "",
    deviceId,
    isAdmin: Boolean(result.User.Policy?.IsAdministrator),
  };
  await setSession(session);
}

export type ServerInfoResponse =
  | { ok: true; info: PublicSystemInfo; serverUrl: string }
  | { ok: false; error: string };

/**
 * Validate/inspect a Jellyfin server via its public system info, trying each
 * candidate origin in turn. The winning URL comes back so the caller can
 * persist the scheme that actually worked.
 */
export async function getServerInfo(
  serverUrl?: string,
): Promise<ServerInfoResponse> {
  const targets = candidateUrls(serverUrl ?? (await getActiveServerUrl()));
  if (!targets.length) return { ok: false, error: "no-server" };
  for (const target of targets) {
    try {
      const info = await jfJson<PublicSystemInfo>({
        serverUrl: target,
        deviceId: crypto.randomUUID(),
        path: "/System/Info/Public",
      });
      return { ok: true, info, serverUrl: target };
    } catch (err) {
      // Surface the real reason in the server logs (DNS/timeout/TLS/HTTP status)
      // so unreachable failures behind a reverse proxy can be diagnosed.
      console.error(`[getServerInfo] ${target} failed:`, err);
    }
  }
  return { ok: false, error: "unreachable" };
}

/** Persist a new active server URL after validating it. */
export async function setServerUrlAction(
  serverUrl: string,
): Promise<ServerInfoResponse> {
  const result = await getServerInfo(serverUrl);
  // Save the origin that answered, not what was typed — otherwise a bare
  // `nas.local` that only speaks http would be stored as https and fail later.
  if (result.ok) await setActiveServerUrl(result.serverUrl);
  return result;
}

/** Public users for the "Who's watching?" picker (may be empty). */
export async function getPublicUsers(serverUrl?: string): Promise<UserDto[]> {
  const raw = serverUrl ?? (await getActiveServerUrl());
  const users = await firstReachable(raw, (url) =>
    jfJson<UserDto[]>({
      serverUrl: url,
      deviceId: crypto.randomUUID(),
      path: "/Users/Public",
    }),
  );
  return users ?? [];
}

export type LoginResponse = { ok: true } | { ok: false; error: string };

/** Authenticate with username + password. */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const targets = candidateUrls(await getActiveServerUrl());
  if (!targets.length) return { ok: false, error: "no-server" };
  const deviceId = crypto.randomUUID();

  for (const serverUrl of targets) {
    let res: Response;
    try {
      res = await jfFetch({
        serverUrl,
        deviceId,
        method: "POST",
        path: "/Users/AuthenticateByName",
        body: { Username: username, Pw: password },
      });
    } catch {
      continue; // This origin isn't reachable; try the next candidate.
    }
    // The server answered, so this IS the right origin — a rejected password
    // must not fall through to another scheme.
    if (res.status === 401) return { ok: false, error: "invalid-credentials" };
    if (!res.ok) return { ok: false, error: "server-error" };
    try {
      // This pins the origin that answered into the session (and mirrors it to
      // the readable server cookie). It matters: the session's serverUrl is
      // what the /api/jf proxy talks to for the rest of the session, so it has
      // to be fully qualified — not whatever scheme-less value was configured.
      const result = (await res.json()) as AuthenticationResult;
      await sessionFromResult(serverUrl, deviceId, result);
    } catch {
      return { ok: false, error: "server-error" };
    }
    return { ok: true };
  }
  return { ok: false, error: "unreachable" };
}

export async function isQuickConnectEnabled(
  serverUrl?: string,
): Promise<boolean> {
  const raw = serverUrl ?? (await getActiveServerUrl());
  const enabled = await firstReachable(raw, (url) =>
    jfJson<boolean>({
      serverUrl: url,
      deviceId: crypto.randomUUID(),
      path: "/QuickConnect/Enabled",
    }),
  );
  return enabled === true;
}

interface PendingQuickConnect {
  secret: string;
  deviceId: string;
  serverUrl: string;
}

/** Begin a Quick Connect attempt; returns the code to display to the user. */
export async function quickConnectInitiate(): Promise<
  { ok: true; code: string } | { ok: false; error: string }
> {
  const raw = await getActiveServerUrl();
  if (!candidateUrls(raw).length) return { ok: false, error: "no-server" };
  const deviceId = crypto.randomUUID();

  const started = await firstReachable(raw, async (serverUrl) => {
    const result = await jfJson<QuickConnectResult>({
      serverUrl,
      deviceId,
      path: "/QuickConnect/Initiate",
    });
    return { serverUrl, result };
  });
  if (!started) return { ok: false, error: "unreachable" };
  if (!started.result.Secret || !started.result.Code) {
    return { ok: false, error: "disabled" };
  }

  // The poll that completes this attempt reuses the origin recorded here, so
  // it must be the resolved one, not the raw configured value.
  const pending: PendingQuickConnect = {
    secret: started.result.Secret,
    deviceId,
    serverUrl: started.serverUrl,
  };
  const store = await cookies();
  store.set(QUICK_CONNECT_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return { ok: true, code: started.result.Code };
}

export type QuickConnectStatus =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "authenticated" }
  | { status: "error"; error: string };

/** Poll a pending Quick Connect attempt; completes the session when approved. */
export async function quickConnectPoll(): Promise<QuickConnectStatus> {
  const store = await cookies();
  const raw = store.get(QUICK_CONNECT_COOKIE)?.value;
  if (!raw) return { status: "idle" };
  let pending: PendingQuickConnect;
  try {
    pending = JSON.parse(raw) as PendingQuickConnect;
  } catch {
    return { status: "idle" };
  }
  try {
    const state = await jfJson<QuickConnectResult>({
      serverUrl: pending.serverUrl,
      deviceId: pending.deviceId,
      path: "/QuickConnect/Connect",
      query: { Secret: pending.secret },
    });
    if (!state.Authenticated) return { status: "waiting" };

    const result = await jfJson<AuthenticationResult>({
      serverUrl: pending.serverUrl,
      deviceId: pending.deviceId,
      method: "POST",
      path: "/Users/AuthenticateWithQuickConnect",
      body: { Secret: pending.secret },
    });
    // Records the resolved origin in the session (and the server cookie).
    await sessionFromResult(pending.serverUrl, pending.deviceId, result);
    store.delete(QUICK_CONNECT_COOKIE);
    return { status: "authenticated" };
  } catch {
    return { status: "error", error: "unreachable" };
  }
}

export async function quickConnectCancel(): Promise<void> {
  const store = await cookies();
  store.delete(QUICK_CONNECT_COOKIE);
}

/** Sign out: revoke the token server-side and clear the session cookie. */
export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await jfFetch({
        serverUrl: session.serverUrl,
        deviceId: session.deviceId,
        token: session.token,
        method: "POST",
        path: "/Sessions/Logout",
      });
    } catch {
      // Best-effort; clear locally regardless.
    }
  }
  await clearSession();
}
