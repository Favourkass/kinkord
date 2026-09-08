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
