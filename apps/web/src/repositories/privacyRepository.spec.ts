import { afterEach, describe, it, expect, vi } from "vitest";
import { PRIVACY_FIELD_KEYS } from "@/domain/privacy";
import { privacyRepository } from "./privacyRepository";
afterEach(() => vi.unstubAllGlobals());
describe("privacy repository", () => {
  const settings = Object.fromEntries(PRIVACY_FIELD_KEYS.map((key) => [key, "members"]));
  it("loads current settings with the member session and no cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ settings })));
    vi.stubGlobal("fetch", fetch);
    expect(await privacyRepository.read()).toEqual({ settings });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/privacy$/),
      expect.objectContaining({ credentials: "include", cache: "no-store", method: "GET" }),
    );
  });
  it("sends a partial patch without a user-supplied owner identifier", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ settings })));
    vi.stubGlobal("fetch", fetch);
    await privacyRepository.update({ bio: "verified" });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: '{"bio":"verified"}' });
  });
  it("rejects unsuccessful responses without treating them as defaults", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(privacyRepository.read()).rejects.toThrow();
  });
});
