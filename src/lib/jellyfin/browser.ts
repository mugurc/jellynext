/**
 * Browser-side Jellyfin data access. Everything routes through the BFF proxy
 * (`/api/jf/...`) so the access token stays in the httpOnly session cookie.
 */
export type Query = Record<
  string,
  string | number | boolean | undefined | null
>;

const PROXY_BASE = "/api/jf";

function withQuery(path: string, query?: Query): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!query) return `${PROXY_BASE}${clean}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${PROXY_BASE}${clean}${qs ? `?${qs}` : ""}`;
}

export class JfHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "JfHttpError";
  }
}

async function request<T>(
  method: string,
  path: string,
  { query, body }: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(withQuery(path, query), {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // React Query is the cache of record; never let the HTTP layer serve stale
    // JSON (e.g. an item's old image tag after updating its poster).
    cache: "no-store",
  });
  if (!res.ok) {
    throw new JfHttpError(res.status, res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const jf = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>("POST", path, { body, query }),
  delete: <T>(path: string, query?: Query) =>
    request<T>("DELETE", path, { query }),
};

export type ImageType =
  "Primary" | "Backdrop" | "Thumb" | "Logo" | "Banner" | "Art" | "Chapter";

interface ImageOptions {
  tag?: string | null;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  index?: number;
}

/** Proxy URL for an item's artwork. Returns null when no image tag exists. */
export function itemImageUrl(
  itemId: string,
  type: ImageType,
  opts: ImageOptions = {},
): string {
  const { index, ...rest } = opts;
  const suffix = index != null ? `/${index}` : "";
  return withQuery(`/Items/${itemId}/Images/${type}${suffix}`, {
    tag: rest.tag ?? undefined,
    maxWidth: rest.maxWidth,
    maxHeight: rest.maxHeight,
    quality: rest.quality ?? 90,
  });
}

/** Proxy URL for a user's avatar image. */
export function userImageUrl(
  userId: string,
  tag?: string | null,
  maxWidth = 160,
): string {
  return withQuery(`/Users/${userId}/Images/Primary`, {
    tag: tag ?? undefined,
    maxWidth,
    quality: 90,
  });
}
