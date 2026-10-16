import { describe, expect, it, vi } from "vitest";
import { communityStatsRepository } from "@/repositories/communityStats.repository";
import { GET } from "./route";
vi.mock("@/repositories/communityStats.repository", () => ({
  communityStatsRepository: { readPlatform: vi.fn() },
}));
describe("public community stats proxy", () => {
  it("returns the real aggregate to signed-out visitors", async () => {
    vi.mocked(communityStatsRepository.readPlatform).mockResolvedValue({ members: 42 });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ members: 42 });
  });
  it("returns unavailable instead of a fabricated total", async () => {
    vi.mocked(communityStatsRepository.readPlatform).mockResolvedValue(null);
    expect((await GET()).status).toBe(503);
  });
});
