import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { RelationshipsController } from "./relationships.controller";
import type { RelationshipsService } from "./relationships.service";

const req = { user: { id: "u1" } } as unknown as AuthedRequest;

function make() {
  const service = {
    options: vi.fn(() => ({ ds: [], romantic: [] })),
    list: vi.fn(async () => ({ links: [], incoming: [], outgoing: [] })),
    request: vi.fn(async () => ({ links: [], incoming: [], outgoing: [] })),
    accept: vi.fn(async () => ({ links: [], incoming: [], outgoing: [] })),
    remove: vi.fn(async () => ({ links: [], incoming: [], outgoing: [] })),
  };
  return {
    controller: new RelationshipsController(service as unknown as RelationshipsService),
    service,
  };
}

describe("RelationshipsController", () => {
  it("asks on behalf of the signed-in member", async () => {
    const { controller, service } = make();
    await controller.request(req, { username: " @Tolu ", type: "dominant" });
    expect(service.request).toHaveBeenCalledWith("u1", "@Tolu", "dominant");
  });

  it("refuses a malformed ask", () => {
    const { controller, service } = make();
    for (const body of [
      {},
      { username: "tolu" },
      { username: "no spaces here", type: "partner" },
      { username: "tolu", type: "partner", requesterId: "u9" },
    ])
      expect(() => controller.request(req, body)).toThrow(BadRequestException);
    expect(service.request).not.toHaveBeenCalled();
  });

  it("accepts, removes and lists as the signed-in member", async () => {
    const { controller, service } = make();
    await controller.accept(req, "r1");
    await controller.remove(req, "r1");
    await controller.list(req);
    expect(service.accept).toHaveBeenCalledWith("u1", "r1");
    expect(service.remove).toHaveBeenCalledWith("u1", "r1");
    expect(service.list).toHaveBeenCalledWith("u1");
  });

  it("needs a signed-in member for everything", async () => {
    const { GUARDS_METADATA } = await import("@nestjs/common/constants");
    const { AuthGuard } = await import("../auth/auth.guard");
    expect(Reflect.getMetadata(GUARDS_METADATA, RelationshipsController)).toContain(AuthGuard);
  });
});
