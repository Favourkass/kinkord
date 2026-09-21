import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";

/**
 * Socket.IO adapter that fans `server.to(room).emit(...)` across every Fargate
 * task via ElastiCache pub/sub. Without it, an autoscaled deployment silently
 * drops a message whenever the recipient's socket happens to be on a different
 * task than the sender's request — the failure mode is "messages disappear at
 * peak load", which is the worst possible time to discover it.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly subClient: Redis;
  private readonly log = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly pubClient: Redis,
  ) {
    super(app);
    // Dedicated because the adapter issues blocking SUBSCRIBE commands; sharing
    // with the pub client would deadlock the process the moment it subscribes.
    this.subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, this.subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(server: Server) {
    await super.close(server);
    await this.subClient.quit().catch((e) => this.log.warn(`sub client quit: ${e}`));
  }
}
