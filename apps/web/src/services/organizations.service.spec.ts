import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./apiClient", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

// A fresh store per test: it lives for the session in the app.
const load = async () => {
  vi.resetModules();
  return import("./organizations.service");
};

beforeEach(() => get.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("organizationsStore", () => {
  it("reads the organizations once, however many screens ask, and tells them", async () => {
    get.mockResolvedValue({
      items: [{ userId: "o1", username: "kinkord_ng", displayName: "Kinkord NG", country: "NG" }],
    });
    const { organizationsStore } = await load();
    const heard = vi.fn();
    organizationsStore.subscribe(heard);
    await Promise.all([organizationsStore.load(), organizationsStore.load()]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/members/organizations");
    expect([...organizationsStore.snapshot()]).toEqual(["o1"]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("tries again on the next ask after a failed read", async () => {
    get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [] });
    const { organizationsStore } = await load();
    await organizationsStore.load();
    expect(organizationsStore.snapshot().size).toBe(0);
    await organizationsStore.load();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("stops telling a screen that has gone", async () => {
    get.mockResolvedValue({ items: [] });
    const { organizationsStore } = await load();
    const heard = vi.fn();
    const stop = organizationsStore.subscribe(heard);
    stop();
    await organizationsStore.load();
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("isOrganization", () => {
  it("is an account the founders made an organization's, or the official one", async () => {
    vi.stubEnv("NEXT_PUBLIC_KINKORD_OFFICIAL_USER_ID", "official");
    const { isOrganization } = await load();
    const known = new Set(["o1"]);
    expect(isOrganization("o1", known)).toBe(true);
    expect(isOrganization("official", known)).toBe(true);
    expect(isOrganization("u2", known)).toBe(false);
    expect(isOrganization(null, known)).toBe(false);
  });
});
