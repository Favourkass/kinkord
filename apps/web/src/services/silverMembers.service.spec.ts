import { describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./apiClient", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

const { silverMembersAdminApi } = await import("./silverMembers.service");

describe("silverMembersAdminApi", () => {
  it("asks for one kind of Silver member, a search and a page", async () => {
    await silverMembersAdminApi.list("ring", "@te ga", 2);
    expect(get).toHaveBeenCalledWith("/admin/silver-members?source=ring&q=%40te%20ga&page=2");
  });
});
