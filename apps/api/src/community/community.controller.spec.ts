import { describe, expect, it, vi } from "vitest";
import { CommunityController } from "./community.controller";
import { type CommunityService } from "./community.service";

describe("CommunityController", () => {
  it("returns the community stats from the service", async () => {
    const stats = vi.fn().mockResolvedValue({ members: 128 });
    const controller = new CommunityController({ stats } as unknown as CommunityService);
    await expect(controller.stats()).resolves.toEqual({ members: 128 });
    expect(stats).toHaveBeenCalledOnce();
  });
});
