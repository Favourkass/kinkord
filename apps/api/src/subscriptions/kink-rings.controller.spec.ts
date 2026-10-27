import { describe, expect, it, vi } from "vitest";
import { KinkRingsController } from "./kink-rings.controller";

const req = (id: string) => ({ user: { id } }) as never;

describe("KinkRingsController", () => {
  const rings = () => ({
    mine: vi.fn(async () => ({ available: [], given: [] })),
    give: vi.fn(async () => ({
      ringId: "r1",
      to: { username: "ada", displayName: "Ada" },
      left: 0,
    })),
  });

  it("lists the caller's own rings", async () => {
    const service = rings();
    await new KinkRingsController(service as never).mine(req("me"));
    expect(service.mine).toHaveBeenCalledWith("me");
  });

  it("gives a ring as the caller, to a username", async () => {
    const service = rings();
    await new KinkRingsController(service as never).give(req("me"), { username: "ada" });
    expect(service.give).toHaveBeenCalledWith("me", "ada");
  });

  it("refuses a body that names no one, or says whose ring it is", () => {
    const controller = new KinkRingsController(rings() as never);
    expect(() => controller.give(req("me"), {})).toThrow();
    expect(() => controller.give(req("me"), { username: "ada", from: "someone" })).toThrow();
  });
});
