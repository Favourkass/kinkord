import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../redis/redis.module";

/**
 * "Is this member connected right now?" — backed by Redis so the answer is the
 * same on every Fargate task. Deliberately separate from the existing
 * `PresenceService` (which writes `profile.last_seen_at` on HTTP traffic):
 * Redis online-state dies the moment a socket disconnects, `last_seen_at`
 * survives for "Last seen 12 minutes ago". Two different questions.
 *
 * A member is online while they have one or more live sockets, so multiple tabs
 * and devices are handled by the shape of the store rather than by counting in
 * the application.
 */
@Injectable()
export class PresenceRedisService {
  /**
   * Safety valve: if a task dies without running disconnect handlers, the keys
   * self-expire instead of showing a ghost online forever. Refreshed on every
   * connect, so an active socket keeps its key alive indefinitely.
   */
  private static readonly TTL_SECONDS = 60 * 60;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(userId: string) {
    return `presence:sockets:${userId}`;
  }

  async markOnline(userId: string, socketId: string): Promise<void> {
    const k = this.key(userId);
    await this.redis.sadd(k, socketId);
    await this.redis.expire(k, PresenceRedisService.TTL_SECONDS);
  }

  /** True when this disconnect took the member's last socket offline. */
  async markOffline(userId: string, socketId: string): Promise<boolean> {
    const k = this.key(userId);
    await this.redis.srem(k, socketId);
    const remaining = await this.redis.scard(k);
    if (remaining <= 0) {
      await this.redis.del(k);
      return true;
    }
    return false;
  }

  /** Batch lookup for a directory page — one pipelined round-trip, not N. */
  async onlineAmong(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const pipe = this.redis.pipeline();
    for (const id of userIds) pipe.exists(this.key(id));
    const res = await pipe.exec();
    if (!res) return [];
    return userIds.filter((_, i) => res[i]?.[1] === 1);
  }
}
