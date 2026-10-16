import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { FriendshipsController } from "./friendships.controller";
import type { FriendshipsService } from "./friendships.service";
const req = { user: { id: "me" } } as AuthedRequest;
describe("FriendshipsController", () => {
  it("authenticates every request and always acts for the signed-in user", async () => {
    const accept = vi.fn();
    const c = new FriendshipsController({ accept } as unknown as FriendshipsService);
    await c.accept(req, "raven");
    expect(accept).toHaveBeenCalledWith("me", "raven");
    expect(Reflect.getMetadata("__guards__", FriendshipsController)).toContain(AuthGuard);
  });
  it("rejects bad handles and invalid request-list queries", () => {
    const c = new FriendshipsController({} as FriendshipsService);
    expect(() => c.request(req, "bad name")).toThrow(BadRequestException);
    expect(() => c.requests(req, { direction: "everyone" })).toThrow(BadRequestException);
    expect(() => c.requests(req, { page: 0 })).toThrow(BadRequestException);
  });
});
