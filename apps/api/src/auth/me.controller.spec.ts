import { describe, expect, it } from "vitest";
import { MeController } from "./me.controller";
import { type AuthedRequest } from "./auth.guard";

describe("MeController", () => {
  it("returns the public projection including username and 2FA state", () => {
    const req = {
      user: {
        id: "u1",
        email: "a@b.c",
        name: "Favour",
        emailVerified: true,
        image: null,
        createdAt: "2026-08-19",
        username: "tegamaxwell",
        displayUsername: "TegaMaxwell",
        twoFactorEnabled: true,
        ageAttested: true, // must NOT leak through
      },
    } as unknown as AuthedRequest;

    const result = new MeController().me(req);
    expect(result).toEqual({
      id: "u1",
      email: "a@b.c",
      name: "Favour",
      emailVerified: true,
      image: null,
      createdAt: "2026-08-19",
      username: "tegamaxwell",
      displayUsername: "TegaMaxwell",
      twoFactorEnabled: true,
    });
    expect("ageAttested" in result).toBe(false);
  });

  it("defaults twoFactorEnabled to false when the plugin fields are absent", () => {
    const req = {
      user: {
        id: "u1",
        email: "a@b.c",
        name: "F",
        emailVerified: false,
        image: null,
        createdAt: "x",
      },
    } as unknown as AuthedRequest;
    const result = new MeController().me(req);
    expect(result.twoFactorEnabled).toBe(false);
    expect(result.username).toBeNull();
  });
});
