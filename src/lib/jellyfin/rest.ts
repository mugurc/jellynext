import "server-only";

import { CLIENT_NAME, CLIENT_VERSION, DEVICE_NAME } from "./constants";
import { jellyfinFetch } from "@/lib/http/dispatcher";

/** Build the Jellyfin `Authorization` header (token optional pre-auth). */
export function authHeader(deviceId: string, token?: string): string {
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="${DEVICE_NAME}"`,
    `DeviceId="${deviceId}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

export interface JfRequest {
  serverUrl: string;
  deviceId: string;
  token?: string;
  method?: string;
  /** Path beginning with "/", e.g. "/Users/AuthenticateByName". */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function buildUrl(
  serverUrl: string,
  path: string,
  query?: JfRequest["query"],
): string {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    serverUrl.replace(/\/+$/, "") + "/",
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Low-level Jellyfin fetch. Returns the raw Response. */
export async function jfFetch(req: JfRequest): Promise<Response> {
  const { serverUrl, deviceId, token, method = "GET", path, query, body } = req;
  const headers: Record<string, string> = {
    Authorization: authHeader(deviceId, token),
    Accept: "application/json",
    ...req.headers,
  };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return jellyfinFetch(buildUrl(serverUrl, path, query), {
    method,
    headers,
    body: payload,
    signal: req.signal,
    cache: "no-store",
  });
}

/** Jellyfin fetch that parses JSON and throws on non-2xx. */
export async function jfJson<T>(req: JfRequest): Promise<T> {
  const res = await jfFetch(req);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new JellyfinError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class JellyfinError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "JellyfinError";
  }
}
