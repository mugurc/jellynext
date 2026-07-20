import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * Thin proxy to the TMDb v3 API that injects the server-side `TMDB_API_KEY`
 * so it never reaches the browser. Read-only: GET only, discovery endpoints
 * (trending/popular/etc.). Returns 501 when no key is configured.
 */
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "tmdb-not-configured" }, { status: 501 });
  }

  const { path } = await ctx.params;
  const params = new URLSearchParams(req.nextUrl.search);
  params.set("api_key", apiKey);
  const target = `${TMDB_BASE}/${path.map(encodeURIComponent).join("/")}?${params.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: "tmdb-unreachable" }, { status: 502 });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      // TMDb discovery lists change slowly; let the client cache briefly.
      "cache-control": "private, max-age=1800",
    },
  });
}

export const GET = handle;
