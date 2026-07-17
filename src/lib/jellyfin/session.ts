import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_SERVER_URL, SERVER_COOKIE, SESSION_COOKIE } from "./constants";

export interface JnSession {
  serverUrl: string;
  token: string;
  userId: string;
  userName: string;
  deviceId: string;
  isAdmin: boolean;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Read the authenticated session from its httpOnly cookie, if present. */
export async function getSession(): Promise<JnSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JnSession;
    if (parsed.serverUrl && parsed.token && parsed.userId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function setSession(session: JnSession): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  // Mirror the server URL into a readable cookie so pre-auth screens know it.
  store.set(SERVER_COOKIE, session.serverUrl, {
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The server URL to use for pre-auth calls (session → cookie → env default). */
export async function getActiveServerUrl(): Promise<string> {
  const store = await cookies();
  const fromCookie = store.get(SERVER_COOKIE)?.value;
  return (fromCookie || DEFAULT_SERVER_URL).replace(/\/+$/, "");
}

export async function setActiveServerUrl(url: string): Promise<void> {
  const store = await cookies();
  store.set(SERVER_COOKIE, url.replace(/\/+$/, ""), {
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
