import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

/**
 * The seam between "a message was persisted" and "the socket layer should say
 * so". The service depends on this; the gateway registers the server in
 * `afterInit`. Without it the service would need the gateway injected, and the
 * gateway already injects the service — a cycle NestJS refuses to resolve.
 */
@Injectable()
export class RealtimePublisher {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Every socket joins `user:<id>` on connect, so all fan-out targets that room
   * and the Redis adapter distributes it across tasks. No per-conversation room
   * bookkeeping means a conversation can be created and messaged in the same
   * request without a race between "join the room" and "emit to it".
   */
  toUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  toUsers(userIds: Iterable<string>, event: string, payload: unknown): void {
    if (!this.server) return;
    for (const id of userIds) this.server.to(`user:${id}`).emit(event, payload);
  }
}
