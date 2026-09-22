import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS = Symbol("REDIS");

/**
 * The single ioredis client for the process. Socket.IO's Redis adapter needs
 * two (one for publish, one blocking subscribe); that second client is derived
 * inside `RedisIoAdapter` rather than exposed here, because nothing else should
 * touch it.
 *
 * `maxRetriesPerRequest: null` is required by the adapter — ioredis otherwise
 * caps the retry and the adapter's own reconnect logic never gets a chance.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
          maxRetriesPerRequest: null,
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    // `quit()` sends QUIT and waits for the reply; `disconnect()` would drop
    // the connection and leave the adapter's channels dangling during a
    // rolling deploy.
    await this.redis.quit().catch(() => undefined);
  }
}
