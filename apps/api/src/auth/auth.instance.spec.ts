import { describe, expect, it } from "vitest";
import { rejectUsernameChanges } from "./auth.instance";

describe("rejectUsernameChanges (Better Auth update-user hook)", () => {
  it("lets ordinary user updates through untouched", () => {
    const data = { twoFactorEnabled: true, name: "Tega" };
    expect(rejectUsernameChanges(data)).toEqual({ data });
  });

  it("refuses username edits that would bypass the 30-day lock", () => {
    expect(() => rejectUsernameChanges({ username: "x" })).toThrow(/Edit Profile/);
    expect(() => rejectUsernameChanges({ displayUsername: "X" })).toThrow(/Edit Profile/);
  });
});
