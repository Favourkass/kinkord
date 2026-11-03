import { describe, expect, it, vi } from "vitest";
import { type TeamPageService } from "./team-page.service";
import { TeamController } from "./team.controller";

describe("TeamController", () => {
  it("gives anyone the team", async () => {
    const list = vi.fn(async () => [{ username: "ada" }]);
    const controller = new TeamController({ list } as unknown as TeamPageService);
    await expect(controller.list()).resolves.toEqual({ members: [{ username: "ada" }] });
  });
});
