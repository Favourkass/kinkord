import { describe, expect, it } from "vitest";
import {
  canonicalGender,
  cardRoles,
  defaultShow,
  genderShown,
  matchScore,
  pairBonus,
  rankCandidates,
  resolveShow,
  roleSideScore,
  sameGender,
  scoreParts,
  showOptions,
  sidesOf,
  wantedSide,
  type MatchCandidate,
  type MatchViewer,
} from "./matching";

const now = new Date("2026-10-14T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

const viewer = (over: Partial<MatchViewer> = {}): MatchViewer => ({
  roles: [],
  kinks: [],
  lookingFor: [],
  city: null,
  state: null,
  ...over,
});

const candidate = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  userId: "c1",
  roles: [],
  kinks: [],
  lookingFor: [],
  city: null,
  state: null,
  lastSeenAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  hasPhoto: false,
  ...over,
});

describe("who a member is shown: sexuality if they've given it, else gender", () => {
  it("shows a straight member the other gender, and everyone when their gender is unknown", () => {
    expect(defaultShow("Male", "Straight")).toBe("women");
    expect(defaultShow("Female", "Straight")).toBe("men");
    expect(defaultShow(null, "Straight")).toBe("all");
  });

  it("shows a bisexual member both, whatever their gender", () => {
    expect(defaultShow("Male", "Bisexual")).toBe("all");
    expect(defaultShow("Female", "Bisexual")).toBe("all");
    expect(defaultShow(null, "Bisexual")).toBe("all");
  });

  it("falls back to gender when no sexuality is given: men see women, women see men", () => {
    expect(defaultShow("Male", null)).toBe("women");
    expect(defaultShow("Female", null)).toBe("men");
    expect(defaultShow("Male", undefined)).toBe("women");
    expect(defaultShow("Female", "")).toBe("men");
  });

  it("shows everyone when neither is known", () => {
    expect(defaultShow(null, null)).toBe("all");
    expect(defaultShow("", undefined)).toBe("all");
  });

  it("reads the gender sign-up stored in lower case the same as Edit Profile's", () => {
    expect(defaultShow("male", null)).toBe("women");
    expect(defaultShow(" female ", "Straight")).toBe("men");
    expect(canonicalGender("FEMALE")).toBe("Female");
    expect(canonicalGender("other")).toBeNull();
  });

  it("goes by gender for a sexuality it has no rule for", () => {
    expect(defaultShow("Male", "Pansexual")).toBe("women");
    expect(defaultShow("Female", "constructor")).toBe("men");
  });

  it("has the same-gender rule ready for when Gay/Lesbian are offered", () => {
    expect(sameGender("Male")).toBe("men");
    expect(sameGender("Female")).toBe("women");
    expect(sameGender(null)).toBe("all");
  });
});

describe("the segments offered", () => {
  it("offers Women | Men to members with one default, and All first to those who see everyone", () => {
    expect(showOptions("women")).toEqual(["women", "men"]);
    expect(showOptions("men")).toEqual(["women", "men"]);
    expect(showOptions("all")).toEqual(["all", "women", "men"]);
  });

  it("ranks for the segment asked for, or the member's default when none is asked", () => {
    expect(resolveShow(undefined, "Male", "Straight")).toEqual({
      show: "women",
      options: ["women", "men"],
    });
    expect(resolveShow("men", "Male", "Straight")).toEqual({
      show: "men",
      options: ["women", "men"],
    });
    expect(resolveShow("women", "Male", "Bisexual")).toEqual({
      show: "women",
      options: ["all", "women", "men"],
    });
  });

  it("ignores a segment the member isn't offered", () => {
    expect(resolveShow("all", "Female", null)).toEqual({ show: "men", options: ["women", "men"] });
  });

  it("names the gender each segment lists", () => {
    expect(genderShown("women")).toBe("Female");
    expect(genderShown("men")).toBe("Male");
    expect(genderShown("all")).toBeNull();
  });
});

describe("kink role sides", () => {
  it("puts roles on the dom side, the sub side, or neither", () => {
    expect(sidesOf(["Dominant", "Rigger"])).toEqual({ dom: true, sub: false, switch: false });
    expect(sidesOf(["Adult Baby Diaper Lover (ABDL)"])).toEqual({
      dom: false,
      sub: true,
      switch: false,
    });
    expect(sidesOf(["Switch"])).toEqual({ dom: false, sub: false, switch: true });
    expect(sidesOf(["Voyeur", "Curious"])).toEqual({ dom: false, sub: false, switch: false });
  });

  it("wants the other side: doms want subs, subs want doms, Switches and both-siders want either", () => {
    expect(wantedSide(["Domme", "Sadist"])).toBe("sub");
    expect(wantedSide(["Submissive", "Pet"])).toBe("dom");
    expect(wantedSide(["Switch"])).toBe("either");
    expect(wantedSide(["Top", "Bottom"])).toBe("either");
    expect(wantedSide(["Voyeur"])).toBeNull();
    expect(wantedSide([])).toBeNull();
  });
});

describe("role side score", () => {
  it("scores the wanted side +4, a Switch +2, the viewer's own side alone -2, anyone else 0", () => {
    expect(roleSideScore("sub", ["Submissive"])).toBe(4);
    expect(roleSideScore("sub", ["Switch"])).toBe(2);
    expect(roleSideScore("sub", ["Dominant"])).toBe(-2);
    expect(roleSideScore("sub", ["Voyeur"])).toBe(0);
    expect(roleSideScore("dom", ["Master"])).toBe(4);
    expect(roleSideScore("dom", ["Brat"])).toBe(-2);
  });

  it("counts a candidate with a role on the wanted side as wanted, whatever else they are", () => {
    expect(roleSideScore("sub", ["Dominant", "Submissive"])).toBe(4);
    expect(roleSideScore("sub", ["Switch", "Bottom"])).toBe(4);
    expect(roleSideScore("sub", ["Dominant", "Switch"])).toBe(2);
  });

  it("gives a Switch viewer either side, never a penalty", () => {
    expect(roleSideScore("either", ["Dominant"])).toBe(4);
    expect(roleSideScore("either", ["Little"])).toBe(4);
    expect(roleSideScore("either", ["Switch"])).toBe(2);
    expect(roleSideScore("either", ["Voyeur"])).toBe(0);
  });

  it("scores nothing for a viewer with no preference", () => {
    expect(roleSideScore(null, ["Submissive"])).toBe(0);
    expect(roleSideScore(null, ["Dominant"])).toBe(0);
  });
});

describe("pair bonus", () => {
  it("adds +2 for a pair, whichever way round", () => {
    expect(pairBonus(["Dominant"], ["Submissive"])).toBe(2);
    expect(pairBonus(["Submissive"], ["Domme"])).toBe(2);
    expect(pairBonus(["Caregiver"], ["Adult Baby Diaper Lover (ABDL)"])).toBe(2);
    expect(pairBonus(["Pet"], ["Handler"])).toBe(2);
    expect(pairBonus(["Voyeur"], ["Exhibitionist"])).toBe(2);
    expect(pairBonus(["Rigger"], ["Rope Bunny"])).toBe(2);
  });

  it("counts each pair once and caps the bonus at +4", () => {
    expect(pairBonus(["Dominant", "Submissive"], ["Submissive", "Dominant"])).toBe(2);
    expect(pairBonus(["Top", "Sadist"], ["Bottom", "Masochist"])).toBe(4);
    expect(pairBonus(["Top", "Sadist", "Brat Tamer"], ["Bottom", "Masochist", "Brat"])).toBe(4);
  });

  it("adds nothing when no pair is completed", () => {
    expect(pairBonus(["Dominant"], ["Dominant"])).toBe(0);
    expect(pairBonus(["Master"], ["Submissive"])).toBe(0);
    expect(pairBonus([], ["Slave"])).toBe(0);
  });
});

describe("score parts", () => {
  it("adds +1 per shared kink up to +5, and +1 per shared looking-for up to +3", () => {
    const kinks = ["Bondage", "Spanking", "Latex", "Leather", "Wax play", "Tickling", "Gags"];
    const lookingFor = ["Friendship", "Events", "Vanilla dating", "Sexual Partner"];
    expect(
      scoreParts(
        viewer({ kinks: kinks.slice(0, 2), lookingFor: ["Friendship"] }),
        candidate({ kinks, lookingFor }),
        now,
      ),
    ).toMatchObject({ kinks: 2, lookingFor: 1 });
    expect(
      scoreParts(viewer({ kinks, lookingFor }), candidate({ kinks, lookingFor }), now),
    ).toMatchObject({ kinks: 5, lookingFor: 3 });
  });

  it("scores the same city +4, else the same state +3, else nothing", () => {
    const me = viewer({ state: "Lagos", city: "Ikeja" });
    expect(scoreParts(me, candidate({ state: "Lagos", city: "Ikeja" }), now).place).toBe(4);
    expect(scoreParts(me, candidate({ state: "lagos ", city: "IKEJA" }), now).place).toBe(4);
    expect(scoreParts(me, candidate({ state: "Lagos", city: "Lekki" }), now).place).toBe(3);
    expect(scoreParts(me, candidate({ state: "Lagos", city: null }), now).place).toBe(3);
    // A town of the same name in another state is not the same place.
    expect(scoreParts(me, candidate({ state: "Ogun", city: "Ikeja" }), now).place).toBe(0);
    expect(scoreParts(viewer(), candidate({ state: "Lagos" }), now).place).toBe(0);
  });

  it("scores online now +2, else seen in the last 7 days +1", () => {
    const part = (lastSeenAt: Date | null) =>
      scoreParts(viewer(), candidate({ lastSeenAt }), now).presence;
    expect(part(minutesAgo(1))).toBe(2);
    expect(part(minutesAgo(30))).toBe(1);
    expect(part(daysAgo(6))).toBe(1);
    expect(part(daysAgo(8))).toBe(0);
    expect(part(null)).toBe(0);
  });

  it("scores a profile photo +2", () => {
    expect(scoreParts(viewer(), candidate({ hasPhoto: true }), now).photo).toBe(2);
    expect(scoreParts(viewer(), candidate({ hasPhoto: false }), now).photo).toBe(0);
  });

  it("adds every part up", () => {
    const me = viewer({
      roles: ["Dominant"],
      kinks: ["Bondage"],
      lookingFor: ["Friendship"],
      state: "Lagos",
      city: "Ikeja",
    });
    const them = candidate({
      roles: ["Submissive"],
      kinks: ["Bondage"],
      lookingFor: ["Friendship"],
      state: "Lagos",
      city: "Ikeja",
      lastSeenAt: minutesAgo(2),
      hasPhoto: true,
    });
    expect(scoreParts(me, them, now)).toEqual({
      side: 4,
      pairs: 2,
      kinks: 1,
      lookingFor: 1,
      place: 4,
      presence: 2,
      photo: 2,
    });
    expect(matchScore(me, them, now)).toBe(16);
    expect(matchScore(me, candidate({ roles: ["Dominant"] }), now)).toBe(-2);
  });
});

describe("ranking", () => {
  it("puts the best match first", () => {
    const me = viewer({ roles: ["Dominant"], state: "Lagos" });
    const ranked = rankCandidates(
      me,
      [
        candidate({ userId: "dom", roles: ["Dominant"], state: "Lagos" }),
        candidate({ userId: "sub", roles: ["Submissive"], state: "Lagos" }),
        candidate({ userId: "switch", roles: ["Switch"], state: "Lagos" }),
      ],
      now,
    );
    expect(ranked.map((c) => c.userId)).toEqual(["sub", "switch", "dom"]);
  });

  it("breaks a tie by who was seen most recently, then the newest account, then the id", () => {
    const ranked = rankCandidates(
      viewer(),
      [
        candidate({ userId: "never", lastSeenAt: null }),
        candidate({ userId: "older", lastSeenAt: daysAgo(10) }),
        candidate({ userId: "recent", lastSeenAt: daysAgo(9) }),
        candidate({ userId: "b", lastSeenAt: null, createdAt: new Date("2026-05-01") }),
        candidate({ userId: "a", lastSeenAt: null, createdAt: new Date("2026-05-01") }),
      ],
      now,
    );
    expect(ranked.map((c) => c.userId)).toEqual(["recent", "older", "a", "b", "never"]);
  });
});

describe("the roles on a card", () => {
  it("leads with the roles on the side the viewer looks for, three at most", () => {
    expect(cardRoles(["Voyeur", "Dominant", "Submissive", "Brat"], "sub")).toEqual([
      "Submissive",
      "Brat",
      "Voyeur",
    ]);
    expect(cardRoles(["Switch", "Top", "Bottom"], "dom")).toEqual(["Top", "Switch", "Bottom"]);
    expect(cardRoles(["Voyeur", "Switch", "Pet", "Owner"], "either")).toEqual([
      "Pet",
      "Owner",
      "Voyeur",
    ]);
  });

  it("keeps the member's own order when the viewer has no preference", () => {
    expect(cardRoles(["Voyeur", "Dominant", "Switch", "Pet"], null)).toEqual([
      "Voyeur",
      "Dominant",
      "Switch",
    ]);
  });
});
