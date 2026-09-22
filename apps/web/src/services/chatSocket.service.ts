import { io, type Socket } from "socket.io-client";
import type { ChatMessage, SendMessageAck, SendMessagePayload } from "@/domain/chat";

interface ServerToClient {
  "presence:update": (p: { userId: string; online: boolean }) => void;
  "message:new": (m: ChatMessage) => void;
  "message:read": (p: { conversationId: string; userId: string; messageId: string }) => void;
  typing: (p: { conversationId: string; userId: string; isTyping: boolean }) => void;
}

interface ClientToServer {
  "message:send": (p: SendMessagePayload, ack: (r: SendMessageAck) => void) => void;
  "message:read": (p: { conversationId: string; messageId: string }) => void;
  typing: (p: { conversationId: string; isTyping: boolean }) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: (Socket<ServerToClient, ClientToServer> & { __wired?: true }) | null = null;
let refCount = 0;

/**
 * One connection for the tab. Multiple presenters subscribe and unsubscribe
 * without a new handshake — a chat app that reconnects every time the user
 * opens a screen shows a "Connecting…" flicker that users read as broken.
 */
function ensure(): Socket<ServerToClient, ClientToServer> {
  if (socket) return socket;
  const s = io(API, {
    path: "/ws",
    withCredentials: true,
    // The API advertises WebSocket only. Asking for polling would force sticky
    // sessions on the load balancer for nothing.
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  }) as Socket<ServerToClient, ClientToServer> & { __wired?: true };
  socket = s;
  return s;
}

export const chatSocket = {
  /** Idempotent. Returns a release function that closes when the last caller leaves. */
  acquire(): () => void {
    ensure();
    refCount += 1;
    return () => {
      refCount -= 1;
      if (refCount <= 0 && socket) {
        socket.disconnect();
        socket = null;
        refCount = 0;
      }
    };
  },

  on<E extends keyof ServerToClient>(event: E, handler: ServerToClient[E]): () => void {
    const s = ensure();
    s.on(event, handler as never);
    return () => s.off(event, handler as never);
  },

  sendMessage(payload: SendMessagePayload): Promise<SendMessageAck> {
    const s = ensure();
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: "Send timed out." }), 10_000);
      s.emit("message:send", payload, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  },

  markRead(conversationId: string, messageId: string): void {
    ensure().emit("message:read", { conversationId, messageId });
  },

  typing(conversationId: string, isTyping: boolean): void {
    ensure().emit("typing", { conversationId, isTyping });
  },
};
