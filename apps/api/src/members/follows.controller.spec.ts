import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { type AuthedRequest } from "../auth/auth.guard";
import { FollowsController } from "./follows.controller";
import { type FollowsService } from "./follows.service";

const req = { user: { id: "me", name: "Me" } } as unknown as AuthedRequest;

const makeController = () => {
  const follow = vi.fn().mockResolvedValue({ following: true, followersCount: 1 });
  const unfollow = vi.fn().mockResolvedValue({ following: false, followersCount: 0 });
  const controller = new FollowsController({ follow, unfollow } as unknown as FollowsService);
  return { controller, follow, unfollow };
};

describe("FollowsController", () => {
  it("rejects malformed handles before touching the service", () => {
    const { controller, follow } = makeController();
    expect(() => controller.follow(req, "not a handle!")).toThrow(BadRequestException);
    expect(() => controller.follow(req, "ab")).toThrow(BadRequestException);
    expect(follow).not.toHaveBeenCalled();
  });

  it("follows and unfollows with the viewer id and the raw handle (with or without @)", async () => {
    const { controller, follow, unfollow } = makeController();
    await expect(controller.follow(req, "@Raven")).resolves.toEqual({
      following: true,
      followersCount: 1,
    });
    expect(follow).toHaveBeenCalledWith("me", "@Raven");

    await expect(controller.unfollow(req, "raven")).resolves.toEqual({
      following: false,
      followersCount: 0,
    });
    expect(unfollow).toHaveBeenCalledWith("me", "raven");
  });
});
