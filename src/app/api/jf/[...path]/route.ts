import { NextResponse, type NextRequest } from "next/server";
import { authHeader } from "@/lib/jellyfin/rest";
import { getSession } from "@/lib/jellyfin/session";

export const dynamic = "force-dynamic";

// Headers worth forwarding from the client to Jellyfin (media range requests etc.)
const FORWARD_REQ_HEADERS = ["range", "if-none-match", "if-modified-since"];
// Headers worth surfacing back from Jellyfin to the client.
const FORWARD_RES_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
  "x-content-duration",
];

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const target = `${session.serverUrl}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers();
  headers.set("Authorization", authHeader(session.deviceId, session.token));
  for (const h of FORWARD_REQ_HEADERS) {
    const value = req.headers.get(h);
    if (value) headers.set(h, value);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  if (hasBody) {
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "upstream-unreachable" },
      { status: 502 },
    );
  }

  const resHeaders = new Headers();
  for (const h of FORWARD_RES_HEADERS) {
    const value = upstream.headers.get(h);
    if (value) resHeaders.set(h, value);
  }
  // Cache immutable artwork aggressively on the client.
  if (path[0] === "Items" && path.includes("Images")) {
    resHeaders.set("cache-control", "private, max-age=86400");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
