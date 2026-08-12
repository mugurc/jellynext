export const CLIENT_NAME = "JellyNext";
export const CLIENT_VERSION = "1.0.0";
export const DEVICE_NAME = "JellyNext Web";

/** httpOnly cookie holding the authenticated session (server URL + token + user). */
export const SESSION_COOKIE = "jn_session";
/** Readable cookie holding the active server URL before/after login. */
export const SERVER_COOKIE = "jn_server";
/** httpOnly cookie holding a pending Quick Connect attempt. */
export const QUICK_CONNECT_COOKIE = "jn_qc";

/** Compile-time default server; overridable in-app via the SERVER_COOKIE. */
export const DEFAULT_SERVER_URL = (
  process.env.NEXT_PUBLIC_JELLYFIN_SERVER_URL ?? ""
).replace(/\/+$/, "");
