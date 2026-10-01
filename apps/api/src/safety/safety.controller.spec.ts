import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import type { BlocksService } from "./blocks.service";
import type { ReportsService } from "./reports.service";
import { SafetyController } from "./safety.controller";

const req = {
  user: { id: "u1", email: "u1@example.com", emailVerified: true },
} as unknown as AuthedRequest;

function make() {
  const blocks = { block: vi.fn(async () => undefined), unblock: vi.fn(async () => undefined) };
  const reports = { create: vi.fn(async () => ({ id: "r1" })) };
  return {
    controller: new SafetyController(
      blocks as unknown as BlocksService,
      reports as unknown as ReportsService,
    ),
    blocks,
    reports,
  };
}

describe("SafetyController", () => {
  it("blocks and unblocks for the signed-in member", async () => {
    const { controller, blocks } = make();
    await expect(controller.block(req, { userId: "u2" })).resolves.toEqual({ blocked: "u2" });
    await expect(controller.unblock(req, "u2")).resolves.toEqual({ unblocked: "u2" });
    expect(blocks.block).toHaveBeenCalledWith("u1", "u2");
    expect(blocks.unblock).toHaveBeenCalledWith("u1", "u2");
  });

  it("files a report from the signed-in member", async () => {
    const { controller, reports } = make();
    await expect(
      controller.report(req, { userId: "u2", reason: "harassment", block: true }),
    ).resolves.toEqual({ id: "r1" });
    expect(reports.create).toHaveBeenCalledWith("u1", {
      userId: "u2",
      reason: "harassment",
      block: true,
    });
  });

  it("refuses a report without a reason it knows", async () => {
    const { controller, reports } = make();
    await expect(controller.report(req, { userId: "u2" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(reports.create).not.toHaveBeenCalled();
  });
});
