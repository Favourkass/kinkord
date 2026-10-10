/**
 * Live chat over AppSync Events. The API hands the app where to connect and a
 * short-lived token. Events only say that a thread changed; the app fetches
 * the change from the API, so message text never passes through AppSync.
 */
export type RealtimeConnectionPM =
  | { enabled: false }
  | {
      enabled: true;
      url: string;
      host: string;
      channel: string;
      token: string;
      expiresAt: string;
    };

/** A chat changed, or the member's notifications did (something new, or read elsewhere). */
export type RealtimeEventPM =
  | { type: "message"; conversationId: string }
  | { type: "typing"; conversationId: string; typing: boolean; expiresAt: number }
  | { type: "notification" };

/** Base64url without padding, as AppSync's handshake header wants it. */
function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The WebSocket subprotocols AppSync expects, with the auth header inside. */
export function connectionProtocols(conn: { host: string; token: string }): string[] {
  const header = base64Url(JSON.stringify({ host: conn.host, Authorization: conn.token }));
  return ["aws-appsync-event-ws", `header-${header}`];
}

/** Our events out of an AppSync "data" frame; anything else or malformed is skipped. */
export function eventsFromFrame(frame: unknown): RealtimeEventPM[] {
  const f = frame as { type?: unknown; event?: unknown } | null;
  if (f?.type !== "data") return [];
  const items = Array.isArray(f.event) ? f.event : [f.event];
  const out: RealtimeEventPM[] = [];
  for (const item of items) {
    let e: {
      type?: unknown;
      conversationId?: unknown;
      typing?: unknown;
      expiresAt?: unknown;
    } | null = null;
    try {
      e = typeof item === "string" ? JSON.parse(item) : (item as typeof e);
    } catch {
      continue;
    }
    if (e?.type === "message" && typeof e.conversationId === "string") {
      out.push({ type: "message", conversationId: e.conversationId });
    } else if (
      e?.type === "typing" &&
      typeof e.conversationId === "string" &&
      typeof e.typing === "boolean" &&
      typeof e.expiresAt === "number" &&
      Number.isFinite(e.expiresAt)
    ) {
      out.push({
        type: "typing",
        conversationId: e.conversationId,
        typing: e.typing,
        expiresAt: e.expiresAt,
      });
    } else if (e?.type === "notification") {
      out.push({ type: "notification" });
    }
  }
  return out;
}
