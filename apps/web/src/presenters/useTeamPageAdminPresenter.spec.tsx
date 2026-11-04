// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { TeamPageAdminMemberPM } from "@/domain/team";
import { useTeamPageAdminPresenter } from "./useTeamPageAdminPresenter";

const list = vi.fn();
const setTitle = vi.fn();
const remove = vi.fn();
vi.mock("@/services/team.service", () => ({
  teamPageAdminApi: {
    list: (...a: unknown[]) => list(...a),
    setTitle: (...a: unknown[]) => setTitle(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));
const access = { checking: false, isAdmin: true, isFounder: true };
vi.mock("./useAdminAccessPresenter", () => ({ useAdminAccessPresenter: () => access }));

const ada: TeamPageAdminMemberPM = {
  id: "u7",
  username: "ada",
  displayName: "Ada",
  avatarUrl: null,
  title: "Software Engineer",
  blocked: false,
};
const kemi: TeamPageAdminMemberPM = {
  ...ada,
  id: "u8",
  username: "kemi",
  displayName: "Kemi",
  title: null,
};

describe("useTeamPageAdminPresenter", () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ members: [ada, kemi], canManage: true });
    setTitle.mockReset();
    remove.mockReset();
  });

  it("lists the team: roles for those on the page, and why the rest aren't", async () => {
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows.map((r) => [r.name, r.title, r.shown])).toEqual([
      ["Ada", "Software Engineer", true],
      ["Kemi", "No role yet, so not on Meet the Team", false],
    ]);
    expect(result.current.canManage).toBe(true);
    expect(result.current.pageHref).toBe("/about/team");
  });

  it("asks for a username and a role before saving anything", async () => {
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.form.submit());
    expect(result.current.form.error).toBe("Enter their username.");
    act(() => result.current.form.setUsername("@tolu"));
    act(() => result.current.form.submit());
    expect(result.current.form.error).toBe("Say what they do at Kinkord.");
    expect(setTitle).not.toHaveBeenCalled();
  });

  it("adds someone with their role, then shows the team as it now stands", async () => {
    setTitle.mockResolvedValue({
      ...kemi,
      id: "u9",
      username: "tolu",
      title: "Community Educator",
    });
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.form.setUsername(" @Tolu "));
    act(() => result.current.form.setTitle("  Community   Educator "));
    await act(async () => result.current.form.submit());
    expect(setTitle).toHaveBeenCalledWith("tolu", "Community Educator");
    expect(result.current.notice).toBe("@tolu is on Meet the Team as Community Educator.");
    expect(result.current.form.username).toBe("");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("changes a role from the row, keeping the handle", async () => {
    setTitle.mockResolvedValue({ ...ada, title: "Lead Engineer" });
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.edit("u7"));
    expect(result.current.form).toMatchObject({
      username: "@ada",
      title: "Software Engineer",
      editing: true,
    });
    act(() => result.current.form.setTitle("Lead Engineer"));
    await act(async () => result.current.form.submit());
    expect(setTitle).toHaveBeenCalledWith("ada", "Lead Engineer");
    expect(result.current.notice).toBe("@ada is now shown as Lead Engineer.");
    expect(result.current.form.editing).toBe(false);
  });

  it("shows why a role couldn't be saved", async () => {
    setTitle.mockRejectedValue(new Error("No member has the username @nobody."));
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.form.setUsername("nobody"));
    act(() => result.current.form.setTitle("Engineer"));
    await act(async () => result.current.form.submit());
    expect(result.current.form.error).toBe("No member has the username @nobody.");
    expect(result.current.form.username).toBe("nobody");
  });

  it("takes someone off after asking", async () => {
    remove.mockResolvedValue({ removed: "u7" });
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.remove("u7"));
    expect(result.current.dialog?.title).toBe("Take Ada off Meet the Team?");
    expect(result.current.dialog?.destructive).toBe(true);
    await act(async () => result.current.dialog?.confirm());
    expect(remove).toHaveBeenCalledWith("u7");
    expect(result.current.dialog).toBeNull();
    expect(result.current.notice).toBe(
      "Ada is off Meet the Team and no longer has the Kinkord Team badge.",
    );
  });

  it("shows other admins the team without the controls", async () => {
    list.mockResolvedValue({ members: [ada], canManage: false });
    const { result } = renderHook(() => useTeamPageAdminPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.canManage).toBe(false);
    expect(result.current.labels.locked).toBe(
      "Only the founders can change who is on Meet the Team.",
    );
  });
});
