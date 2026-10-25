import { describe, expect, it } from "vitest";
import type { Db } from "../db/db.module";
import type { EmailService } from "../email/email.service";
import type { SignupGuardService } from "../moderation/signup-guard.service";
import { buildAuth, rejectReservedNames, rejectUsernameChanges } from "./auth.instance";

describe("buildAuth", () => {
  const auth = buildAuth({} as Db, {} as EmailService, {} as SignupGuardService);

  it("signs every device out when a password is reset, so an intruder can't stay in", () => {
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });

  it("limits wrong passwords through its hooks, which in-process sign-ins pass through too", () => {
    expect(auth.options.hooks?.before).toBeTypeOf("function");
    expect(auth.options.hooks?.after).toBeTypeOf("function");
  });
});

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

describe("rejectReservedNames (Better Auth create and update-user hooks)", () => {
  it("refuses a new account named or handled after Kinkord, however it's written", () => {
    for (const account of [
      { name: "Kinkord", username: "ada" },
      { name: "KINKORD official", username: "ada" },
      { name: "Ada", username: "kin_kord" },
      { name: "Ada", username: "ada", displayUsername: "K.i.n.k.o.r.d" },
    ]) {
      expect(() => rejectReservedNames(account), JSON.stringify(account)).toThrow(
        "That name is reserved.",
      );
    }
    expect(() => rejectReservedNames({ name: "Ada", username: "ada" })).not.toThrow();
  });

  it("refuses renaming an account to Kinkord, but lets the account that has it keep it", () => {
    expect(() => rejectReservedNames({ name: "Kinkord" }, "Ada")).toThrow(/reserved/);
    expect(() => rejectReservedNames({ name: "Kinkord HQ" }, "Kinkord")).not.toThrow();
    // update-user always sends the key; an absent name changes nothing.
    expect(() => rejectReservedNames({ name: undefined }, "Ada")).not.toThrow();
  });
});
