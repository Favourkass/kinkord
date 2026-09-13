import { describe, expect, it } from "vitest";
import { RedisService } from "./redis.service";

describe("RedisService without REDIS_URL", () => {
  it("does not require Redis for startup or chat fallbacks", async () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    try {
      const redis = new RedisService();
      await redis.onModuleInit();

      await expect(redis.onlineUsers()).resolves.toEqual([]);
      await expect(redis.unreadSnapshot("user-1")).resolves.toEqual({});
      await expect(redis.bumpUnread("user-1", "conversation-1")).resolves.toBe(0);
      await expect(redis.addSocket("user-1", "socket-1")).resolves.toEqual({ becameOnline: false });
    } finally {
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  });
});
