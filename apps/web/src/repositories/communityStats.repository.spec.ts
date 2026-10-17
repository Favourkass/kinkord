import { afterEach, describe, expect, it, vi } from "vitest";
import { communityStatsRepository } from "./communityStats.repository";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("communityStatsRepository", () => {
  it("reads only the aggregate count without sending credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ members: 12487, privateField: "ignored" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(communityStatsRepository.read()).resolves.toEqual({ members: 12487 });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/community/stats",
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    );
  });
  it.each([-1, 1.5, "12487", null, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid counts (%s)",
    async (members) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ members })));
      await expect(communityStatsRepository.read()).resolves.toBeNull();
    },
  );
  it("preserves a real zero and handles service failures without inventing a count", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ members: 0 }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    await expect(communityStatsRepository.read()).resolves.toEqual({ members: 0 });
    await expect(communityStatsRepository.read()).resolves.toBeNull();
    await expect(communityStatsRepository.read()).resolves.toBeNull();
  });
});

it("uses the server's dev proxy when the browser API prefix is relative", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "/backend");
  vi.stubEnv("KINKORD_DEV_API_PROXY", "http://127.0.0.1:4383");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ members: 20 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(communityStatsRepository.readPlatform()).resolves.toEqual({ members: 20 });
  expect(fetcher).toHaveBeenCalledWith(
    "http://127.0.0.1:4383/community/public-stats",
    expect.objectContaining({ credentials: "omit" }),
  );
});
