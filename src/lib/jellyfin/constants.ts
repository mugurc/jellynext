export const CLIENT_NAME = "JellyNext";
export const CLIENT_VERSION = "1.0.0";
export const DEVICE_NAME = "JellyNext Web";

/** httpOnly cookie holding the authenticated session (server URL + token + user). */
export const SESSION_COOKIE = "jn_session";
/** Readable cookie holding the active server URL before/after login. */
export const SERVER_COOKIE = "jn_server";
/** httpOnly cookie holding a pending Quick Connect attempt. */
export const QUICK_CONNECT_COOKIE = "jn_qc";

/**
 * Default server, used until someone picks one (which is then kept in the
 * SERVER_COOKIE).
 *
 * Read per call rather than at module scope, and from a server-only name: a
 * `NEXT_PUBLIC_` value is inlined into the bundle during `next build`, so a
 * prebuilt Docker image could never be pointed at a different server. Reading
 * `JELLYFIN_SERVER_URL` at request time is what makes `docker run -e …` work.
 * The public name stays as a fallback so existing setups keep working.
 *
 * Only ever called from server code (see session.ts), so nothing here reaches
 * the browser bundle.
 */
export function defaultServerUrl(): string {
  const raw =
    process.env.JELLYFIN_SERVER_URL ||
    process.env.NEXT_PUBLIC_JELLYFIN_SERVER_URL ||
    "";
  return raw.replace(/\/+$/, "");
}
