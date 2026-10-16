// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminTeamMemberPM } from "@/domain/moderation";
import { useAdminTeamPresenter } from "./useAdminTeamPresenter";

const access = vi.fn();
const team = vi.fn();
const addAdmin = vi.fn();
const removeAdmin = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: {
    access: () => access(),
    team: () => team(),
    addAdmin: (...a: unknown[]) => addAdmin(...a),
    removeAdmin: (...a: unknown[]) => removeAdmin(...a),
  },
}));

const founder: AdminTeamMemberPM = {
  id: "u1",
  name: "Favour",
  displayName: null,
  username: "favour",
  avatarUrl: null,
  founder: true,
  since: null,
};

const jane: AdminTeamMemberPM = {
  id: "u7",
  name: "Jane Doe",
  displayName: "Lady Jane",
  username: "ladyjane",
  avatarUrl: null,
  founder: false,
  since: "2026-10-10T09:00:00.000Z",
};

describe("useAdminTeamPresenter", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ isAdmin: true });
    team.mockReset().mockResolvedValue({ admins: [founder], canManage: true });
    addAdmin.mockReset().mockResolvedValue(jane);
    removeAdmin.mockReset().mockResolvedValue({ removed: "u7" });
  });
  afterEach(cleanup);

  it("lists the admins, and a founder can't be removed", async () => {
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]).toMatchObject({
      title: "Favour",
      handle: "@favour",
      note: "Founder",
      href: "/moderation/members/u1",
      removable: false,
    });
    expect(result.current.canManage).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("asks before making someone an admin, then adds them", async () => {
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.form.setUsername(" @LadyJane "));
    act(() => result.current.form.submit());
    expect(addAdmin).not.toHaveBeenCalled();
    expect(result.current.dialog?.title).toBe("Make @ladyjane an admin?");
    await act(async () => result.current.dialog?.confirm());
    expect(addAdmin).toHaveBeenCalledWith("ladyjane");
    expect(result.current.dialog).toBeNull();
    expect(result.current.notice).toBe("@ladyjane is now an admin.");
    expect(result.current.form.username).toBe("");
    expect(result.current.rows.map((r) => [r.title, r.note, r.removable])).toEqual([
      ["Favour", "Founder", false],
      ["Lady Jane", "Admin since 10 Oct 2026", true],
    ]);
  });

  it("needs a username before asking", async () => {
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.form.setUsername(" @ "));
    act(() => result.current.form.submit());
    expect(result.current.form.error).toBe("Enter their username.");
    expect(result.current.dialog).toBeNull();
  });

  it("keeps the dialog open with the API's answer when it refuses", async () => {
    addAdmin.mockRejectedValue(new Error("No member has the username @ladyjayne."));
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.form.setUsername("ladyjayne"));
    act(() => result.current.form.submit());
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("No member has the username @ladyjayne.");
    expect(result.current.rows).toHaveLength(1);
  });

  it("removes an admin once confirmed", async () => {
    team.mockResolvedValue({ admins: [founder, jane], canManage: true });
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.remove("u7"));
    expect(result.current.dialog).toMatchObject({
      title: "Remove Lady Jane as an admin?",
      destructive: true,
    });
    await act(async () => result.current.dialog?.confirm());
    expect(removeAdmin).toHaveBeenCalledWith("u7");
    expect(result.current.notice).toBe("Lady Jane is no longer an admin.");
    expect(result.current.rows.map((r) => r.id)).toEqual(["u1"]);
  });

  it("shows other admins the list but nothing to change it with", async () => {
    team.mockResolvedValue({ admins: [founder, jane], canManage: false });
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.canManage).toBe(false);
    expect(result.current.rows.every((r) => !r.removable)).toBe(true);
    act(() => result.current.remove("u7"));
    expect(result.current.dialog).toBeNull();
  });

  it("never loads the list for someone who isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminTeamPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(team).not.toHaveBeenCalled();
  });
});
