import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../auth/auth.guard";
import { CommunityController } from "./community.controller";
import { type CommunityService } from "./community.service";

describe("CommunityController", () => {
  it("returns the community stats from the service", async () => {
    const stats = vi.fn().mockResolvedValue({ members: 128 });
    const controller = new CommunityController({ stats } as unknown as CommunityService);
    await expect(controller.stats()).resolves.toEqual({ members: 128 });
    expect(stats).toHaveBeenCalledOnce();
  });
  it("publishes only the aggregate without changing the signed-in stats guard", async () => {
    const publicStats = vi.fn().mockResolvedValue({ members: 20 });
    const controller = new CommunityController({ publicStats } as unknown as CommunityService);
    await expect(controller.publicStats()).resolves.toEqual({ members: 20 });
    expect(
      Reflect.getMetadata("__guards__", CommunityController.prototype.publicStats),
    ).toBeUndefined();
    expect(Reflect.getMetadata("__guards__", CommunityController.prototype.stats)).toContain(
      AuthGuard,
    );
  });
});
