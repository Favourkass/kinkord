import { describe, expect, it } from "vitest";
import {
  teamTitle,
  toTeamMemberVM,
  toTeamPageAdminRowVM,
  type TeamPageAdminMemberPM,
} from "./team";

describe("toTeamMemberVM", () => {
  it("makes a card: name, handle, role and where it leads", () => {
    expect(
      toTeamMemberVM(
        {
          username: "ada",
          displayName: "Ada Obi",
          avatarUrl: "https://x/a.jpg",
          title: "Software Engineer",
        },
        (u) => `/u/${u}`,
      ),
    ).toEqual({
      key: "ada",
      name: "Ada Obi",
      handle: "@ada",
      title: "Software Engineer",
      avatarUrl: "https://x/a.jpg",
      initial: "A",
      href: "/u/ada",
    });
  });

  it("falls back to the handle for a blank name", () => {
    const vm = toTeamMemberVM(
      { username: "kemi", displayName: "  ", avatarUrl: null, title: "Community Educator" },
      (u) => `/u/${u}`,
    );
    expect(vm.name).toBe("@kemi");
    expect(vm.initial).toBe("K");
  });
});

describe("toTeamPageAdminRowVM", () => {
  const labels = { noTitle: "No role yet", blocked: "Blocked" };
  const member: TeamPageAdminMemberPM = {
    id: "u7",
    username: "ada",
    displayName: "Ada",
    avatarUrl: null,
    title: "Software Engineer",
    blocked: false,
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("shows the role of someone on the page", () => {
    expect(toTeamPageAdminRowVM(member, labels, href)).toEqual({
      id: "u7",
      name: "Ada",
      handle: "@ada",
      avatarUrl: null,
      title: "Software Engineer",
      shown: true,
      href: "/moderation/members/u7",
      username: "ada",
      currentTitle: "Software Engineer",
    });
  });

  it("says why someone is left off the page", () => {
    const noRole = toTeamPageAdminRowVM({ ...member, title: null }, labels, href);
    expect(noRole).toMatchObject({ title: "No role yet", shown: false, currentTitle: "" });
    const blocked = toTeamPageAdminRowVM({ ...member, blocked: true }, labels, href);
    expect(blocked).toMatchObject({
      title: "Blocked",
      shown: false,
      currentTitle: "Software Engineer",
    });
  });
});

describe("teamTitle", () => {
  it("keeps the role to one trimmed line", () => {
    expect(teamTitle("  Community \n Educator ")).toBe("Community Educator");
    expect(teamTitle("   ")).toBe("");
  });
});
