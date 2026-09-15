import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ConversationsService } from "./conversations.service";
import type { Db } from "../db/db.module";
import type { RedisService } from "../redis/redis.service";
import type { StorageService } from "../storage/storage.service";

const makeService = (target: unknown) => {
  const db = {
    query: {
      users: { findFirst: vi.fn(async () => target) },
      conversations: { findFirst: vi.fn(async () => null) },
    },
  } as unknown as Db;
  return new ConversationsService(
    db,
    {} as RedisService,
    {} as StorageService,
  );
};

describe("ConversationsService", () => {
  it("rejects starting a DM with yourself as a bad request", async () => {
    const service = makeService({ id: "user-1" });

    await expect(service.ensureDm("user-1", "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a DM target that does not exist", async () => {
    const service = makeService(null);

    await expect(service.ensureDm("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});