import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const del = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    post: (...a: unknown[]) => post(...a),
    del: (...a: unknown[]) => del(...a),
  },
}));

import { safetyService } from "./safety.service";

describe("safetyService", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({});
    del.mockReset().mockResolvedValue({});
  });

  it("blocks and unblocks a member by id", async () => {
    await safetyService.block("u2");
    await safetyService.unblock("u/2");
    expect(post).toHaveBeenCalledWith("/blocks", { userId: "u2" });
    expect(del).toHaveBeenCalledWith("/blocks/u%2F2");
  });

  it("sends a report as it was written", async () => {
    const input = { userId: "u2", conversationId: "c1", reason: "spam" as const, block: true };
    await safetyService.report(input);
    expect(post).toHaveBeenCalledWith("/reports", input);
  });
});
