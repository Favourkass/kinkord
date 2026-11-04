import { describe, expect, it, vi } from "vitest";

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

const { teamApi, teamPageAdminApi } = await import("./team.service");

describe("teamApi", () => {
  it("reads Meet the Team", async () => {
    get.mockResolvedValueOnce({ members: [{ username: "ada" }] });
    await expect(teamApi.list()).resolves.toEqual([{ username: "ada" }]);
    expect(get).toHaveBeenCalledWith("/team");
  });
});

describe("teamPageAdminApi", () => {
  it("lists, sets a role and removes", async () => {
    await teamPageAdminApi.list();
    expect(get).toHaveBeenCalledWith("/admin/team-page");
    await teamPageAdminApi.setTitle("ada", "Software Engineer");
    expect(post).toHaveBeenCalledWith("/admin/team-page", {
      username: "ada",
      title: "Software Engineer",
    });
    await teamPageAdminApi.remove("u/7");
    expect(del).toHaveBeenCalledWith("/admin/team-page/u%2F7");
  });
});
