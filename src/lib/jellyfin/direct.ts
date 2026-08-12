"use client";

/**
 * Credentials for fetching media straight from Jellyfin, skipping the BFF proxy.
 *
 * Why bypass it: relaying a movie through the Next server adds a hop to every
 * byte, and — the part that actually hurts — to every range request the browser
 * makes while locating a container index before it can render a single frame.
 * That is most of the "why does direct play take so long to start" delay.
 *
 * Why this is not a new exposure: the access token lives in an httpOnly cookie,
 * but `/api/socket-info` already hands it to page scripts so they can open the
 * Jellyfin WebSocket. Same-origin JS could already act as the user through
 * `/api/jf` regardless, so sourcing media directly doesn't widen the surface.
 */
export interface MediaCredentials {
  serverUrl: string;
  token: string;
}

let pending: Promise<MediaCredentials | null> | null = null;
/** Set once direct playback has been proven not to work on this deployment. */
let disabled = false;

/**
 * Credentials for direct media access, or null when it isn't available — the
 * caller should then build proxy URLs instead.
 */
export function getMediaCredentials(): Promise<MediaCredentials | null> {
  if (disabled) return Promise.resolve(null);
  pending ??= fetch("/api/socket-info")
    .then((res) => (res.ok ? res.json() : null))
    .then((info: { serverUrl?: string; token?: string } | null) => {
      if (!info?.serverUrl || !info.token) return null;
      return {
        serverUrl: info.serverUrl.replace(/\/+$/, ""),
        token: info.token,
      };
    })
    .catch(() => null);
  return pending;
}

/**
 * Give up on direct media for the rest of the session and route everything back
 * through `/api/jf`.
 *
 * Direct access can legitimately fail where the proxy succeeds: the server may
 * not send CORS headers, the browser may block http media on an https page
 * (mixed content), or the Jellyfin port may simply not be reachable from the
 * client's network even though it is from ours. Callers flip this on the first
 * media error and retry through the proxy; sharing the flag means the audio bar
 * doesn't have to rediscover the same failure.
 */
export function disableDirectMedia(): void {
  disabled = true;
}

/** Whether direct media has been ruled out (for diagnostics/UI copy). */
export function isDirectMediaDisabled(): boolean {
  return disabled;
}
