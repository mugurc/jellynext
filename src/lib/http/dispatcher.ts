import "server-only";

import { Agent, fetch as undiciFetch } from "undici";

/**
 * Dedicated connection pool for outbound Jellyfin requests.
 *
 * Why this exists: the default global `fetch` dispatcher keeps idle keep-alive
 * sockets around for ~5 minutes and, worse, waits up to ~5 minutes
 * (`headersTimeout`) for a response before giving up. The Jellyfin server sits
 * behind Cloudflare, which silently drops idle upstream sockets. After a
 * viewing session churns and aborts many media connections (seeks, audio /
 * quality re-inits, navigation), a later request can be handed one of these
 * dead-but-"idle" sockets and hang for minutes — freezing every page that
 * needs Jellyfin data (the "stuck on Rendering" symptom).
 *
 * Short keep-alive + a bounded headers timeout make the pool self-heal in
 * seconds instead: idle sockets are closed before Cloudflare drops them, and a
 * request unlucky enough to hit a dead socket fails fast (and its socket is
 * discarded) rather than blocking the whole app.
 */
export const jellyfinDispatcher = new Agent({
  keepAliveTimeout: 4_000, // close idle sockets quickly (before CF drops them)
  keepAliveMaxTimeout: 10_000,
  headersTimeout: 30_000, // fail a dead socket in 30s, not ~5 min
  bodyTimeout: 0, // media bodies stream slowly — no inter-chunk timeout
  connect: { timeout: 15_000 },
});

/**
 * A desktop-browser User-Agent. Jellyfin often sits behind Cloudflare, whose
 * bot protection can 403 (error 1010) requests from a bare server runtime like
 * undici. Presenting a normal browser UA avoids that block for server→server
 * calls (the browser talks to us; we talk to Jellyfin on its behalf).
 */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Fetch through {@link jellyfinDispatcher}.
 *
 * We deliberately use undici's OWN `fetch`, not the Node global `fetch`. The
 * global fetch is backed by whatever undici Node bundles internally, and
 * passing an `Agent` from the standalone `undici` package to it throws
 * `invalid onRequestStart method` (UND_ERR_INVALID_ARG) whenever the two undici
 * versions differ (e.g. Node 22's bundled undici vs our undici v8). Using
 * `undici.fetch` guarantees the dispatcher and fetch come from the same undici,
 * so it works on every Node version.
 */
export function jellyfinFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", BROWSER_UA);
  const undiciInit = {
    ...init,
    headers: Object.fromEntries(headers),
    dispatcher: jellyfinDispatcher,
  } as unknown as Parameters<typeof undiciFetch>[1];
  return undiciFetch(input, undiciInit) as unknown as Promise<Response>;
}
