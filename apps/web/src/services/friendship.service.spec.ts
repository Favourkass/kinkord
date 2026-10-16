import { describe, expect, it, vi } from "vitest";
import { friendshipRepository } from "@/repositories/friendship.repository";
import { friendshipService } from "./friendship.service";
vi.mock("@/repositories/friendship.repository", () => ({
  friendshipRepository: {
    request: vi.fn().mockResolvedValue({ friendship: "outgoing" }),
    accept: vi.fn(),
    dismiss: vi.fn(),
    remove: vi.fn(),
    requests: vi.fn(),
  },
}));
describe("friendship service", () => {
  it("routes a friend action to the friendship repository", async () => {
    await expect(friendshipService.change("nene", "request")).resolves.toEqual({
      friendship: "outgoing",
    });
    expect(friendshipRepository.request).toHaveBeenCalledWith("nene");
  });
});
