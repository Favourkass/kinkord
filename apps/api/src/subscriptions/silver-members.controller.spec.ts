import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { SilverMembersController } from "./silver-members.controller";
import { type SilverMembersService } from "./silver-members.service";

describe("SilverMembersController", () => {
  it("lists Silver members by how they got it, a page at a time", async () => {
    const list = vi.fn(async () => ({}));
    const controller = new SilverMembersController({ list } as unknown as SilverMembersService);
    await controller.list({});
    expect(list).toHaveBeenCalledWith("all", undefined, 1);
    await controller.list({ source: "ring", q: " tega ", page: "2" });
    expect(list).toHaveBeenCalledWith("ring", "tega", 2);
  });

  it("refuses a source it doesn't know", () => {
    const controller = new SilverMembersController({} as unknown as SilverMembersService);
    expect(() => controller.list({ source: "gold" })).toThrow(BadRequestException);
  });
});
