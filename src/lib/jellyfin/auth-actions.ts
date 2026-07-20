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

function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
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
  { ok: true; info: PublicSystemInfo } | { ok: false; error: string };

/** Validate/inspect a Jellyfin server via its public system info. */
export async function getServerInfo(
  serverUrl?: string,
): Promise<ServerInfoResponse> {
  const target = normalizeUrl(serverUrl ?? (await getActiveServerUrl()));
  if (!target) return { ok: false, error: "no-server" };
  try {
    const info = await jfJson<PublicSystemInfo>({
      serverUrl: target,
      deviceId: crypto.randomUUID(),
      path: "/System/Info/Public",
    });
    return { ok: true, info };
  } catch (err) {
    // Surface the real reason in the server logs (DNS/timeout/TLS/HTTP status)
    // so unreachable failures behind a reverse proxy can be diagnosed.
    console.error(`[getServerInfo] ${target} failed:`, err);
    return { ok: false, error: "unreachable" };
  }
}

/** Persist a new active server URL after validating it. */
export async function setServerUrlAction(
  serverUrl: string,
): Promise<ServerInfoResponse> {
  const target = normalizeUrl(serverUrl);
  const result = await getServerInfo(target);
  if (result.ok) await setActiveServerUrl(target);
  return result;
}

/** Public users for the "Who's watching?" picker (may be empty). */
export async function getPublicUsers(): Promise<UserDto[]> {
  try {
    const serverUrl = await getActiveServerUrl();
    if (!serverUrl) return [];
    return await jfJson<UserDto[]>({
      serverUrl,
      deviceId: crypto.randomUUID(),
      path: "/Users/Public",
    });
  } catch {
    return [];
  }
}

export type LoginResponse = { ok: true } | { ok: false; error: string };

/** Authenticate with username + password. */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const serverUrl = await getActiveServerUrl();
  if (!serverUrl) return { ok: false, error: "no-server" };
  const deviceId = crypto.randomUUID();
  try {
    const res = await jfFetch({
      serverUrl,
      deviceId,
      method: "POST",
      path: "/Users/AuthenticateByName",
      body: { Username: username, Pw: password },
    });
    if (res.status === 401) return { ok: false, error: "invalid-credentials" };
    if (!res.ok) return { ok: false, error: "server-error" };
    const result = (await res.json()) as AuthenticationResult;
    await sessionFromResult(serverUrl, deviceId, result);
    return { ok: true };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

export async function isQuickConnectEnabled(): Promise<boolean> {
  try {
    const serverUrl = await getActiveServerUrl();
    return await jfJson<boolean>({
      serverUrl,
      deviceId: crypto.randomUUID(),
      path: "/QuickConnect/Enabled",
    });
  } catch {
    return false;
  }
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
  const serverUrl = await getActiveServerUrl();
  if (!serverUrl) return { ok: false, error: "no-server" };
  const deviceId = crypto.randomUUID();
  try {
    const result = await jfJson<QuickConnectResult>({
      serverUrl,
      deviceId,
      path: "/QuickConnect/Initiate",
    });
    if (!result.Secret || !result.Code) {
      return { ok: false, error: "disabled" };
    }
    const pending: PendingQuickConnect = {
      secret: result.Secret,
      deviceId,
      serverUrl,
    };
    const store = await cookies();
    store.set(QUICK_CONNECT_COOKIE, JSON.stringify(pending), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return { ok: true, code: result.Code };
  } catch {
    return { ok: false, error: "unreachable" };
  }
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
