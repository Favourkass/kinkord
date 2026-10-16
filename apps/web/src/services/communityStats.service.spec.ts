import { describe, expect, it, vi } from "vitest";
import { communityStatsRepository } from "@/repositories/communityStats.repository";
import { communityStatsService } from "./communityStats.service";
vi.mock("@/repositories/communityStats.repository", () => ({
  communityStatsRepository: { read: vi.fn() },
}));
describe("communityStatsService", () => {
  it("passes cancellation to the repository and returns the domain count", async () => {
    const signal = new AbortController().signal;
    vi.mocked(communityStatsRepository.read).mockResolvedValue({ members: 42 });
    await expect(communityStatsService.read(signal)).resolves.toEqual({ members: 42 });
    expect(communityStatsRepository.read).toHaveBeenCalledWith(signal);
  });
});
