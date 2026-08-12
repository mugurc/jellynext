import { NextResponse } from "next/server";
import { getSession } from "@/lib/jellyfin/session";

export const dynamic = "force-dynamic";

/**
 * Returns the credentials the browser needs to open a WebSocket directly to
 * Jellyfin (`/socket?api_key=…`). The access token normally lives in an
 * httpOnly cookie; a WS can't send that, so it's surfaced here to the
 * authenticated same-origin client only. (Same-origin JS can already act as
 * the user via the `/api/jf` proxy, so this doesn't widen the attack surface.)
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    serverUrl: session.serverUrl,
    token: session.token,
    deviceId: session.deviceId,
    userId: session.userId,
  });
}
