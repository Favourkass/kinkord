import { afterEach, describe, expect, it, vi } from "vitest";
import { PUSH_GROUP_KEYS } from "@/domain/pushPreferences";
import { pushPreferencesRepository } from "./pushPreferencesRepository";

afterEach(() => vi.unstubAllGlobals());
const settings = Object.fromEntries(PUSH_GROUP_KEYS.map((key) => [key, true]));

describe("push preferences repository", () => {
  it("reads the member's switches with their session and no cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ settings })));
    vi.stubGlobal("fetch", fetch);
    expect(await pushPreferencesRepository.read()).toEqual({ settings });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/push\/preferences$/),
      expect.objectContaining({ credentials: "include", cache: "no-store", method: "GET" }),
    );
  });

  it("sends only the switch that changed", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ settings })));
    vi.stubGlobal("fetch", fetch);
    await pushPreferencesRepository.update({ likes: false });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: '{"likes":false}' });
  });

  it("fails rather than pretending everything is on", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(pushPreferencesRepository.read()).rejects.toThrow();
  });
});
