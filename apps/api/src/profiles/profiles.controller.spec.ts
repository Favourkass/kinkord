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
    changeUsername: vi.fn(async () => ({ username: "nene" })),
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

  it("serves the option lists the pickers render", () => {
    const options = new ProfilesController(serviceMock()).options();
    expect(options.genders).toEqual(["Male", "Female"]);
    expect(options.relationshipStatuses).toHaveLength(17);
    expect(options.roles).toHaveLength(20);
    expect(options.kinks).toHaveLength(50);
    expect(options.lookingFor).toHaveLength(10);
    expect(options.nameChangeCooldownDays).toBe(30);
  });

  it("validates and delegates username changes", async () => {
    const service = serviceMock();
    const controller = new ProfilesController(service);
    expect(() => controller.changeUsername(req, {})).toThrow(BadRequestException);
    await controller.changeUsername(req, { username: " @Nene " });
    expect(service.changeUsername).toHaveBeenCalledWith("u1", "@Nene");
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
      contentLength: 123_456,
    });
    expect(service.presignImageUpload).toHaveBeenCalledWith("u1", "cover", "image/png", 123_456);
  });

  it("rejects a non-positive or fractional contentLength", () => {
    const controller = new ProfilesController(serviceMock());
    for (const contentLength of [0, -5, 12.5]) {
      expect(() =>
        controller.presignUpload(req, { kind: "avatar", contentType: "image/png", contentLength }),
      ).toThrow(BadRequestException);
    }
  });
});
