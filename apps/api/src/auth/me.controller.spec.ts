import { describe, expect, it, vi } from "vitest";
import { MeController } from "./me.controller";
import type { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { type AuthedRequest } from "./auth.guard";

/** Answers the plan lookup: Silver until `end`, or Basic. */
const plans = (end: Date | null = null, silverUntil = vi.fn(async () => end)) =>
  ({ silverUntil }) as unknown as SubscriptionsService;

describe("MeController", () => {
  it("returns the public projection including username and 2FA state", async () => {
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

    const result = await new MeController(plans()).me(req);
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
      plan: "basic",
      silverUntil: null,
    });
    expect("ageAttested" in result).toBe(false);
  });

  it("defaults twoFactorEnabled to false when the plugin fields are absent", async () => {
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
    const result = await new MeController(plans()).me(req);
    expect(result.twoFactorEnabled).toBe(false);
    expect(result.username).toBeNull();
  });

  it("says when a Silver member's plan runs out", async () => {
    const req = {
      user: {
        id: "u1",
        email: "a@b.c",
        name: "F",
        emailVerified: true,
        image: null,
        createdAt: "x",
      },
    } as unknown as AuthedRequest;
    const end = new Date("2026-11-06T12:00:00Z");
    const silverUntil = vi.fn(async () => end);
    const result = await new MeController(plans(end, silverUntil)).me(req);
    expect(result.plan).toBe("silver");
    expect(result.silverUntil).toBe("2026-11-06T12:00:00.000Z");
    // The whole member, so a founder can be put on Silver by their verified email.
    expect(silverUntil).toHaveBeenCalledWith(req.user);
  });
});
