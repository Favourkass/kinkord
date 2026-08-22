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
    presignImageUpload: vi.fn(async () => ({ key: "k", uploadUrl: "u" })),
  }) as unknown as ProfilesService;

describe("ProfilesController", () => {
  it("rejects invalid update payloads with field errors", () => {
    const controller = new ProfilesController(serviceMock());
    expect(() => controller.update(req, { displayName: "x" })).toThrow(BadRequestException);
  });

  it("passes validated updates to the service", async () => {
    const service = serviceMock();
    await new ProfilesController(service).update(req, { country: "ng", roles: ["Switch"] });
    expect(service.updateOwn).toHaveBeenCalledWith(
      "u1",
      { country: "NG", roles: ["Switch"] },
      "Favour",
    );
  });

  it("requires a valid kind for upload URLs", () => {
    const controller = new ProfilesController(serviceMock());
    expect(() =>
      controller.presignUpload(req, { kind: "banner", contentType: "image/png" }),
    ).toThrow(BadRequestException);
  });

  it("passes kind and contentType through to the service", async () => {
    const service = serviceMock();
    await new ProfilesController(service).presignUpload(req, {
      kind: "cover",
      contentType: "image/png",
    });
    expect(service.presignImageUpload).toHaveBeenCalledWith("u1", "cover", "image/png");
  });
});
