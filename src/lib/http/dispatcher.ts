import "server-only";

import { Agent } from "undici";

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

type DispatchableInit = RequestInit & { dispatcher?: Agent };

/** `fetch` routed through {@link jellyfinDispatcher} (Node reads `dispatcher`). */
export function jellyfinFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const withDispatcher: DispatchableInit = {
    ...init,
    dispatcher: jellyfinDispatcher,
  };
  return fetch(input, withDispatcher);
}
