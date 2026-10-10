// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { pendingTransfersRepository as store } from "./pendingTransfers.repository";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("pendingTransfersRepository", () => {
  it("keeps a request per member and slot until it's cleared", () => {
    store.write("gift", "u1", { key: "k1" });
    expect(store.read("gift", "u1")).toEqual({ key: "k1" });
    expect(store.read("gift", "u2")).toBeNull();
    expect(store.read("withdrawal", "u1")).toBeNull();
    store.clear("gift", "u1");
    expect(store.read("gift", "u1")).toBeNull();
  });

  it("reads nothing from a damaged entry or switched-off storage, and never throws", () => {
    localStorage.setItem("kinkord:unanswered:gift:u1", "{not json");
    expect(store.read("gift", "u1")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("off");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("off");
    });
    expect(store.read("gift", "u1")).toBeNull();
    expect(() => store.write("gift", "u1", {})).not.toThrow();
  });
});
