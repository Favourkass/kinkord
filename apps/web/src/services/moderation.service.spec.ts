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

import { moderationService } from "./moderation.service";

describe("moderationService", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({});
    del.mockReset().mockResolvedValue({});
  });

  it("reads the report queue by status, and closes a report", async () => {
    await moderationService.reports();
    await moderationService.reports("dismissed");
    await moderationService.resolveReport("r1", "resolved");
    expect(get.mock.calls).toEqual([
      ["/admin/reports?status=open"],
      ["/admin/reports?status=dismissed"],
    ]);
    expect(post).toHaveBeenCalledWith("/admin/reports/r1/resolve", { status: "resolved" });
  });

  it("encodes the search so an email or a + in it survives the URL", async () => {
    await moderationService.search(" tolu+1@gmail.com ");
    expect(get).toHaveBeenCalledWith("/admin/members?q=tolu%2B1%40gmail.com");
  });

  it("asks to block the deleted member only when told to", async () => {
    await moderationService.deleteMember("u9", { block: true, reason: " spam " });
    await moderationService.deleteMember("u9", { block: false, reason: null });
    expect(del.mock.calls.map((c) => c[0])).toEqual([
      "/admin/members/u9?block=1&reason=spam",
      "/admin/members/u9?block=0",
    ]);
  });

  it("sends the block options as given", async () => {
    await moderationService.block("u9", { reason: "harassment", deletePosts: true });
    expect(post).toHaveBeenCalledWith("/admin/members/u9/block", {
      reason: "harassment",
      deletePosts: true,
    });
  });

  it("targets single posts and rules by id", async () => {
    await moderationService.deletePost("p/1");
    await moderationService.removeRule("r1");
    expect(del.mock.calls.map((c) => c[0])).toEqual(["/admin/posts/p%2F1", "/admin/blocklist/r1"]);
  });

  it("reads and decides verification reviews, and acts on a member's verification", async () => {
    const body = {
      decision: "reject" as const,
      evidenceReference: "didit-1",
      reason: "Not the same person.",
    };
    await moderationService.verificationReviews();
    await moderationService.stepUpVerification("123456");
    await moderationService.decideVerification("v/1", body);
    await moderationService.memberVerification("u9");
    await moderationService.revokeVerification("u9", "Confirmed policy breach.");
    await moderationService.reopenVerification("u9", "Support approved a retry.");
    expect(get.mock.calls).toEqual([
      ["/admin/verification/reviews"],
      ["/admin/verification/members/u9"],
    ]);
    expect(post.mock.calls).toEqual([
      ["/admin/verification/step-up", { code: "123456" }],
      ["/admin/verification/reviews/v%2F1/decision", body],
      ["/admin/verification/members/u9/revoke", { reason: "Confirmed policy breach." }],
      ["/admin/verification/members/u9/reopen", { reason: "Support approved a retry." }],
    ]);
  });
});

it("assigns and removes only the team identity badge", async () => {
  await moderationService.setTeamBadge("u/9", true);
  await moderationService.setTeamBadge("u/9", false);
  expect(post).toHaveBeenCalledWith("/admin/members/u%2F9/team-badge", { enabled: true });
  expect(post).toHaveBeenCalledWith("/admin/members/u%2F9/team-badge", { enabled: false });
});

it("gives an admin Silver, or takes the founders' gift back", async () => {
  await moderationService.setAdminSilver("u/7", true);
  await moderationService.setAdminSilver("u/7", false);
  expect(post.mock.calls.slice(-2)).toEqual([
    ["/admin/staff/u%2F7/silver", { enabled: true }],
    ["/admin/staff/u%2F7/silver", { enabled: false }],
  ]);
});

it("makes an organization's account for its country, or a person's again", async () => {
  await moderationService.setOrganization("u/9", true, "NG");
  await moderationService.setOrganization("u/9", false, "NG");
  expect(post.mock.calls.slice(-2)).toEqual([
    ["/admin/members/u%2F9/organization", { enabled: true, country: "NG" }],
    ["/admin/members/u%2F9/organization", { enabled: false }],
  ]);
});
