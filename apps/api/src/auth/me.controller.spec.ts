import { describe, expect, it } from "vitest";
import { MeController } from "./me.controller";
import { type AuthedRequest } from "./auth.guard";

describe("MeController", () => {
  it("returns only the public projection of the user", () => {
    const req = {
      user: {
        id: "u1",
        email: "a@b.c",
        name: "Favour",
        emailVerified: true,
        image: null,
        createdAt: "2026-08-19",
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
    });
    expect("ageAttested" in result).toBe(false);
  });
});
