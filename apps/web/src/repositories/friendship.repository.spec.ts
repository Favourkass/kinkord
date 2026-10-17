import { afterEach, describe, expect, it, vi } from "vitest";
import { friendshipRepository } from "./friendship.repository";
afterEach(() => vi.unstubAllGlobals());
describe("friendship repository", () => {
  it("uses separate friendship endpoints and includes the signed-in session", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => Response.json({ friendship: "outgoing" }));
    vi.stubGlobal("fetch", fetcher);
    await friendshipRepository.request("@nene");
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining("/friendships/nene"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    await friendshipRepository.accept("nene");
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining("/friendships/nene/accept"),
      expect.objectContaining({ method: "POST" }),
    );
    await friendshipRepository.dismiss("nene");
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining("/friendships/nene/request"),
      expect.objectContaining({ method: "DELETE" }),
    );
    await friendshipRepository.remove("nene");
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining("/friendships/nene"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  it("rejects failed actions instead of pretending they succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
    await expect(friendshipRepository.accept("nene")).rejects.toThrow();
  });
});
