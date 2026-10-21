import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    del: (...a: unknown[]) => del(...a),
  },
}));

import {
  canRequestRelationship,
  relationshipHandle,
  relationshipsApi,
} from "./relationships.service";

beforeEach(() => {
  for (const f of [get, post, del]) f.mockReset().mockResolvedValue({});
});

describe("relationship requests", () => {
  it("reads a username however it was typed", () => {
    expect(relationshipHandle("  @Tolu_99 ")).toBe("tolu_99");
  });

  it("needs a real username and a relationship before asking", () => {
    expect(canRequestRelationship("@tolu", "dominant")).toBe(true);
    expect(canRequestRelationship("@tolu", "")).toBe(false);
    expect(canRequestRelationship("@to", "partner")).toBe(false);
    expect(canRequestRelationship("not a handle", "partner")).toBe(false);
  });

  it("asks, accepts and removes through the API", async () => {
    await relationshipsApi.request(" @Tolu ", "dominant");
    await relationshipsApi.accept("r/1");
    await relationshipsApi.remove("r/1");
    await relationshipsApi.list();
    await relationshipsApi.options();
    expect(post.mock.calls).toEqual([
      ["/relationships", { username: "tolu", type: "dominant" }],
      ["/relationships/r%2F1/accept", {}],
    ]);
    expect(del).toHaveBeenCalledWith("/relationships/r%2F1");
    expect(get.mock.calls).toEqual([["/relationships"], ["/relationships/options"]]);
  });
});
