import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ProfilesController } from "./profiles.controller";
import { type ProfilesService } from "./profiles.service";
import { type AuthedRequest } from "../auth/auth.guard";

const req = { user: { id: "u1", name: "Favour" } } as unknown as AuthedRequest;

const serviceMock = () =>
  ({
    getOwn: vi.fn(async () => ({ displayName: "Favour" })),
    updateOwn: vi.fn(async () => ({ displayName: "FavourK" })),
    presignAvatarUpload: vi.fn(async () => ({ key: "k", uploadUrl: "u" })),
  }) as unknown as ProfilesService;

describe("ProfilesController", () => {
  it("rejects invalid update payloads with field errors", () => {
    const controller = new ProfilesController(serviceMock());
    expect(() => controller.update(req, { displayName: "x" })).toThrow(BadRequestException);
  });

  it("passes validated updates to the service", async () => {
    const service = serviceMock();
    const controller = new ProfilesController(service);
    await controller.update(req, { country: "ng" });
    expect(service.updateOwn).toHaveBeenCalledWith("u1", { country: "NG" }, "Favour");
  });

  it("requires contentType for avatar presign", () => {
    const controller = new ProfilesController(serviceMock());
    expect(() => controller.presignAvatar(req, {})).toThrow(BadRequestException);
  });
});
