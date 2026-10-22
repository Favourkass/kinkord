// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { Routes } from "@/constants/Routes";
import { clockTime, type AdminMemberDetailPM } from "@/domain/moderation";
import { ApiError } from "@/services/apiClient";
import { useAdminMemberPresenter } from "./useAdminMemberPresenter";

// One object for the whole file: a fresh router each render would re-run effects.
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const svc = {
  setTeamBadge: vi.fn(),
  setOrganization: vi.fn(),
  access: vi.fn(),
  member: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  deleteMember: vi.fn(),
  deleteMemberPosts: vi.fn(),
  deletePost: vi.fn(),
  memberVerification: vi.fn(),
  stepUpVerification: vi.fn(),
  revokeVerification: vi.fn(),
  reopenVerification: vi.fn(),
};
vi.mock("@/services/moderation.service", () => ({
  moderationService: new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...a: unknown[]) =>
          svc[name as keyof typeof svc](...a),
    },
  ),
}));

const detail: AdminMemberDetailPM = {
  id: "u9",
  name: "Durowara Tolulope Charles",
  displayName: null,
  username: "downtoearth",
  email: "ctolulope05@gmail.com",
  phone: "+2349054291043",
  avatarUrl: null,
  createdAt: "2026-09-04T16:24:27.065Z",
  lastSeenAt: null,
  posts: 1,
  banned: false,
  admin: false,
  ips: [],
  verifiedPhones: [],
  banReason: null,
  bannedAt: null,
  recentPosts: [
    {
      id: "p1",
      body: "hello",
      createdAt: "2026-09-20T10:00:00Z",
      visibility: "public",
      isRepost: false,
      mediaCount: 0,
      thumbUrl: null,
    },
  ],
  rules: [],
};

const state = (status: string, over: Record<string, unknown> = {}) => ({
  status,
  attemptsUsed: 0,
  own: false,
  protected: false,
  ...over,
});

async function ready() {
  const hook = renderHook(() => useAdminMemberPresenter("u9"));
  await waitFor(() => expect(hook.result.current.vm).not.toBeNull());
  return hook;
}

describe("useAdminMemberPresenter", () => {
  it("assigns the team badge only after confirmation and refreshes its state", async () => {
    svc.access.mockResolvedValue({ isAdmin: true, isFounder: true });
    const hook = await ready();
    await waitFor(() => expect(hook.result.current.canChangeTeamBadge).toBe(true));
    act(() => hook.result.current.onToggleTeamBadge());
    expect(svc.setTeamBadge).not.toHaveBeenCalled();
    expect(hook.result.current.dialog?.title).toContain("Assign Kinkord Team");
    svc.member.mockResolvedValue({ ...detail, teamMember: true });
    await act(async () => hook.result.current.dialog?.confirm());
    await waitFor(() => expect(hook.result.current.vm?.teamMember).toBe(true));
    expect(svc.setTeamBadge).toHaveBeenCalledWith("u9", true);
    act(() => hook.result.current.onToggleTeamBadge());
    expect(hook.result.current.dialog?.title).toContain("Remove Kinkord Team");
    await act(async () => hook.result.current.dialog?.confirm());
    expect(svc.setTeamBadge).toHaveBeenCalledWith("u9", false);
  });

  it("makes an organization's account for the country picked, once a founder confirms", async () => {
    svc.access.mockResolvedValue({ isAdmin: true, isFounder: true });
    const hook = await ready();
    await waitFor(() => expect(hook.result.current.organizationAccount.canChange).toBe(true));
    expect(hook.result.current.organizationAccount.organization).toBe(false);
    // A country first.
    act(() => hook.result.current.organizationAccount.onToggle());
    expect(hook.result.current.dialog).toBeNull();
    expect(hook.result.current.notice).toBe("Choose the organization's country first.");
    act(() => hook.result.current.organizationAccount.setSelected("KE"));
    act(() => hook.result.current.organizationAccount.onToggle());
    expect(hook.result.current.dialog?.title).toBe("Make this an organization's account?");
    expect(svc.setOrganization).not.toHaveBeenCalled();
    svc.member.mockResolvedValue({ ...detail, organization: true, country: "KE" });
    await act(async () => hook.result.current.dialog?.confirm());
    expect(svc.setOrganization).toHaveBeenCalledWith("u9", true, "KE");
    await waitFor(() =>
      expect(hook.result.current.organizationAccount).toMatchObject({
        organization: true,
        countryName: "Kenya",
      }),
    );
    act(() => hook.result.current.organizationAccount.onToggle());
    expect(hook.result.current.dialog?.title).toBe("Make this a person's account again?");
    await act(async () => hook.result.current.dialog?.confirm());
    expect(svc.setOrganization).toHaveBeenLastCalledWith("u9", false, null);
  });

  it("makes one that speaks to every country, and says so", async () => {
    svc.access.mockResolvedValue({ isAdmin: true, isFounder: true });
    const hook = await ready();
    await waitFor(() => expect(hook.result.current.organizationAccount.canChange).toBe(true));
    expect(hook.result.current.organizationAccount.choices[0]).toEqual({
      value: "ALL",
      label: "Every country (like Kinkord Official)",
    });
    act(() => hook.result.current.organizationAccount.setSelected("ALL"));
    act(() => hook.result.current.organizationAccount.onToggle());
    svc.member.mockResolvedValue({ ...detail, organization: true, country: null });
    await act(async () => hook.result.current.dialog?.confirm());
    expect(svc.setOrganization).toHaveBeenCalledWith("u9", true, "ALL");
    await waitFor(() =>
      expect(hook.result.current.organizationAccount.countryName).toBe("every country"),
    );
  });

  it("shows a staff admin the kind of account without letting them change it", async () => {
    const hook = await ready();
    expect(hook.result.current.organizationAccount.canChange).toBe(false);
    act(() => hook.result.current.organizationAccount.setSelected("NG"));
    act(() => hook.result.current.organizationAccount.onToggle());
    expect(hook.result.current.dialog).toBeNull();
  });

  it("shows a staff admin the team badge without letting them change it", async () => {
    const hook = await ready();
    expect(hook.result.current.canChangeTeamBadge).toBe(false);
    act(() => hook.result.current.onToggleTeamBadge());
    expect(hook.result.current.dialog).toBeNull();
    expect(svc.setTeamBadge).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    router.replace.mockReset();
    svc.access.mockResolvedValue({ isAdmin: true });
    svc.member.mockResolvedValue(detail);
    svc.block.mockResolvedValue({ blocked: "u9", postsRemoved: 1 });
    svc.deleteMember.mockResolvedValue({ deleted: "u9" });
    svc.deletePost.mockResolvedValue({ deleted: "p1" });
    svc.memberVerification.mockResolvedValue(state("verified"));
    svc.stepUpVerification.mockResolvedValue({ verifiedUntil: "2026-10-12T12:10:00Z" });
    svc.revokeVerification.mockResolvedValue({ status: "revoked" });
  });
  afterEach(cleanup);

  it("loads the member for an admin", async () => {
    const { result } = await ready();
    expect(result.current.vm?.title).toBe("Durowara Tolulope Charles");
    expect(result.current.dialog).toBeNull();
  });

  it("blocks with the reason and the delete-posts choice, then reloads", async () => {
    const { result } = await ready();
    act(() => result.current.onBlock());
    act(() => result.current.dialog?.reason?.set("harassment"));
    act(() => result.current.dialog?.checkbox?.toggle());
    await act(async () => result.current.dialog?.confirm());

    expect(svc.block).toHaveBeenCalledWith("u9", { reason: "harassment", deletePosts: true });
    await waitFor(() => expect(svc.member).toHaveBeenCalledTimes(2));
    expect(result.current.dialog).toBeNull();
    expect(result.current.notice).toBe("Blocked, and 1 posts deleted.");
  });

  it("won't delete the account until the username is typed", async () => {
    const { result } = await ready();
    act(() => result.current.onDeleteAccount());
    // Deleting blocks re-sign-up by default.
    expect(result.current.dialog?.checkbox?.checked).toBe(true);
    expect(result.current.dialog?.canConfirm).toBe(false);
    act(() => result.current.dialog?.typeToConfirm?.set("@DownToEarth"));
    expect(result.current.dialog?.canConfirm).toBe(true);

    await act(async () => result.current.dialog?.confirm());
    expect(svc.deleteMember).toHaveBeenCalledWith("u9", { block: true, reason: null });
    expect(router.replace).toHaveBeenCalledWith("/moderation");
  });

  it("deletes a single post by its id", async () => {
    const { result } = await ready();
    act(() => result.current.onDeletePost("p1"));
    expect(result.current.dialog?.title).toBe("Delete this post?");
    await act(async () => result.current.dialog?.confirm());
    expect(svc.deletePost).toHaveBeenCalledWith("p1");
    expect(result.current.notice).toBe("Post deleted.");
  });

  it("keeps the dialog open and shows the server's refusal", async () => {
    svc.block.mockRejectedValue(new Error("Admins can't be blocked or deleted here."));
    const { result } = await ready();
    act(() => result.current.onBlock());
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("Admins can't be blocked or deleted here.");
  });

  it("shows the member's verification and revokes it after confirming", async () => {
    const { result } = await ready();
    await waitFor(() => expect(result.current.verification).not.toBeNull());
    expect(result.current.verification).toMatchObject({
      status: "Verified",
      revoke: true,
      reopen: false,
      locked: null,
    });

    act(() => result.current.onRevokeVerification());
    expect(result.current.dialog?.destructive).toBe(true);
    expect(result.current.dialog?.canConfirm).toBe(false);
    // The code comes after the reason, and keeps every digit of a pasted "123 456".
    expect(result.current.dialog?.input).toBeUndefined();
    act(() => result.current.dialog?.reason?.set("Confirmed document fraud."));
    act(() => result.current.dialog?.code?.set("123 456"));
    expect(result.current.dialog?.code?.value).toBe("123456");
    expect(result.current.dialog?.canConfirm).toBe(true);
    svc.memberVerification.mockResolvedValue(state("revoked"));
    await act(async () => result.current.dialog?.confirm());

    expect(svc.stepUpVerification).toHaveBeenCalledWith("123456");
    expect(svc.revokeVerification).toHaveBeenCalledWith("u9", "Confirmed document fraud.");
    expect(result.current.notice).toBe("Verification revoked.");
    await waitFor(() => expect(result.current.verification?.reopen).toBe(true));
  });

  it("shows an expired badge as outdated, and a used-up one as out of attempts", async () => {
    svc.memberVerification.mockResolvedValue(state("outdated", { attemptsUsed: 1 }));
    const { result, unmount } = await ready();
    await waitFor(() => expect(result.current.verification).not.toBeNull());
    expect(result.current.verification?.status).toBe("Verification lapsed after a profile change");
    unmount();

    svc.memberVerification.mockResolvedValue(state("rejected", { attemptsUsed: 3 }));
    const next = await ready();
    await waitFor(() => expect(next.result.current.verification).not.toBeNull());
    expect(next.result.current.verification).toMatchObject({
      status: "Out of attempts",
      attempts: "3 of 3 attempts used",
      reopen: true,
    });
  });

  it("still shows the member when their verification can't be read, and says so", async () => {
    svc.memberVerification.mockRejectedValue(new Error("boom"));
    const { result } = await ready();
    expect(result.current.vm?.id).toBe("u9");
    await waitFor(() =>
      expect(result.current.verificationError).toBe(
        "Couldn't load their identity verification. Refresh to try again.",
      ),
    );
    expect(result.current.verification).toBeNull();
  });

  it("offers no verification actions on your own page or a protected admin's", async () => {
    svc.memberVerification.mockResolvedValue(state("rejected", { own: true }));
    const { result, unmount } = await ready();
    await waitFor(() => expect(result.current.verification).not.toBeNull());
    expect(result.current.verification).toMatchObject({
      revoke: false,
      reopen: false,
      locked: "You can't act on your own verification.",
    });
    unmount();

    svc.memberVerification.mockResolvedValue(state("verified", { protected: true }));
    const next = await ready();
    await waitFor(() => expect(next.result.current.verification).not.toBeNull());
    expect(next.result.current.verification).toMatchObject({
      revoke: false,
      reopen: false,
      locked: "Only a founder can decide an admin's verification.",
    });
  });

  it("reloads the page after a conflict, and won't resend an action no longer on offer", async () => {
    svc.reopenVerification.mockRejectedValue(
      new ApiError(409, { message: "Only a rejected or revoked verification can be reopened." }),
    );
    svc.memberVerification.mockResolvedValue(state("rejected", { attemptsUsed: 3 }));
    const { result } = await ready();
    await waitFor(() => expect(result.current.verification?.reopen).toBe(true));

    act(() => result.current.onReopenVerification());
    act(() => result.current.dialog?.reason?.set("Support approved a retry."));
    act(() => result.current.dialog?.code?.set("123456"));
    // Another admin already reopened it.
    svc.memberVerification.mockResolvedValue(state("not_started"));
    await act(async () => result.current.dialog?.confirm());

    expect(result.current.dialog?.error).toBe(
      "Only a rejected or revoked verification can be reopened.",
    );
    await waitFor(() => expect(svc.member).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.verification?.status).toBe("Not verified"));
    expect(svc.memberVerification).toHaveBeenCalledTimes(2);
    act(() => result.current.dialog?.code?.set("654321"));
    expect(result.current.dialog?.canConfirm).toBe(false);
  });

  it("shows the API's message for a wrong or locked code, and links to Security when 2FA is off", async () => {
    const { result } = await ready();
    await waitFor(() => expect(result.current.verification).not.toBeNull());
    const attempt = async (error: ApiError) => {
      svc.stepUpVerification.mockRejectedValueOnce(error);
      act(() => result.current.onRevokeVerification());
      act(() => result.current.dialog?.reason?.set("Confirmed document fraud."));
      act(() => result.current.dialog?.code?.set("123456"));
      await act(async () => result.current.dialog?.confirm());
    };

    await attempt(new ApiError(403, { message: "That code isn't right.", code: "INVALID_CODE" }));
    expect(result.current.dialog?.error).toBe("That code isn't right.");
    expect(result.current.dialog?.code?.value).toBe("");
    expect(result.current.dialog?.errorLink).toBeNull();

    const retryAt = "2026-10-13T10:15:00Z";
    await attempt(
      new ApiError(429, { message: "Too many wrong codes.", code: "STEP_UP_LOCKED", retryAt }),
    );
    expect(result.current.dialog?.error).toBe(
      `Too many wrong codes. You can try again at ${clockTime(retryAt)}.`,
    );

    await attempt(new ApiError(403, { message: "Turn on 2FA first.", code: "TWO_FACTOR_OFF" }));
    expect(result.current.dialog?.error).toBe("Turn on 2FA first.");
    expect(result.current.dialog?.errorLink).toEqual({
      label: "Turn on two-factor in Security settings",
      href: Routes.settingsSecurity,
    });
    expect(svc.revokeVerification).not.toHaveBeenCalled();
    // Only a conflict re-reads the page.
    expect(svc.member).toHaveBeenCalledOnce();
  });
});
