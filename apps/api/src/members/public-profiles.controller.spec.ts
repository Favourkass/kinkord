import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { type AuthedRequest } from "../auth/auth.guard";
import { type MembersService } from "./members.service";
import { PublicProfilesController } from "./public-profiles.controller";

const req = { user: { id: "me", name: "Me" } } as unknown as AuthedRequest;

describe("PublicProfilesController", () => {
  it("rejects a malformed handle", () => {
    const publicProfile = vi.fn();
    const controller = new PublicProfilesController({
      publicProfile,
    } as unknown as MembersService);
    expect(() => controller.byUsername(req, "bad handle")).toThrow(BadRequestException);
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it("delegates a valid handle with the viewer id", async () => {
    const publicProfile = vi.fn().mockResolvedValue({ username: "nene" });
    const controller = new PublicProfilesController({
      publicProfile,
    } as unknown as MembersService);
    await expect(controller.byUsername(req, "@Nene")).resolves.toEqual({ username: "nene" });
    expect(publicProfile).toHaveBeenCalledWith("@Nene", "me");
  });
});

describe("PublicProfilesController.friends", () => {
  it("defaults to the All tab and forwards paging", async () => {
    const friends = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const controller = new PublicProfilesController({ friends } as unknown as MembersService);
    await controller.friends(req, "nene", {});
    expect(friends).toHaveBeenCalledWith("nene", "me", "all", undefined, undefined);
    await controller.friends(req, "nene", { tab: "mutual", page: "2", limit: "10" });
    expect(friends).toHaveBeenLastCalledWith("nene", "me", "mutual", 2, 10);
  });

  it("rejects an unknown tab or a malformed handle", () => {
    const friends = vi.fn();
    const controller = new PublicProfilesController({ friends } as unknown as MembersService);
    expect(() => controller.friends(req, "nene", { tab: "enemies" })).toThrow(BadRequestException);
    expect(() => controller.friends(req, "bad handle", {})).toThrow(BadRequestException);
    expect(friends).not.toHaveBeenCalled();
  });
});
