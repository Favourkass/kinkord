import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { ModerationController } from "./moderation.controller";
import type { ModerationService } from "./moderation.service";

const founder = { user: { id: "u1", email: "maxihandsome@gmail.com", emailVerified: true } };
const req = founder as unknown as AuthedRequest;

function make() {
  const service = {
    isAdmin: vi.fn(async () => true),
    block: vi.fn(async () => ({ blocked: "u9", postsRemoved: 0 })),
    deleteMember: vi.fn(async () => ({ deleted: "u9" })),
    addRule: vi.fn(async () => ({ id: "r1" })),
  };
  const controller = new ModerationController(service as unknown as ModerationService, {} as never);
  return { controller, service };
}

describe("ModerationController", () => {
  it("tells the app whether the signed-in member is an admin", async () => {
    const { controller } = make();
    await expect(controller.access(req)).resolves.toEqual({ isAdmin: true });
  });

  it("passes a valid block through with the acting admin", async () => {
    const { controller, service } = make();
    await controller.block(req, "u9", { reason: "harassment", deletePosts: true });
    expect(service.block).toHaveBeenCalledWith("u1", "u9", {
      reason: "harassment",
      deletePosts: true,
    });
  });

  it("refuses a block reason longer than the log can usefully hold", async () => {
    const { controller, service } = make();
    await expect(controller.block(req, "u9", { reason: "x".repeat(301) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.block).not.toHaveBeenCalled();
  });

  it("reads ?block=1 as also blocking the deleted member", async () => {
    const { controller, service } = make();
    await controller.deleteMember(req, "u9", "1", undefined);
    await controller.deleteMember(req, "u9", undefined, undefined);
    expect(service.deleteMember.mock.calls.map((c) => (c[2] as { block: boolean }).block)).toEqual([
      true,
      false,
    ]);
  });

  it("rejects a rule of a kind the sign-up check doesn't know", async () => {
    const { controller, service } = make();
    await expect(
      controller.addRule(req, { kind: "username", value: "x", action: "block" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.addRule).not.toHaveBeenCalled();
  });
});
