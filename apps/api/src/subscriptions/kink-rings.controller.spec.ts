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
    await new KinkRingsController(service as never, {} as never).mine(req("me"));
    expect(service.mine).toHaveBeenCalledWith("me");
  });

  it("gives a ring as the caller, to a username", async () => {
    const service = rings();
    await new KinkRingsController(service as never, {} as never).give(req("me"), {
      username: "ada",
    });
    expect(service.give).toHaveBeenCalledWith("me", "ada");
  });

  it("refuses a body that names no one, or says whose ring it is", () => {
    const controller = new KinkRingsController(rings() as never, {} as never);
    expect(() => controller.give(req("me"), {})).toThrow();
    expect(() => controller.give(req("me"), { username: "ada", from: "someone" })).toThrow();
  });
});

it("scopes inventory, pagination and recipient searches to the authenticated member", () => {
  const inventory = { inventory: vi.fn(), history: vi.fn(), expired: vi.fn(), recipients: vi.fn() };
  const controller = new KinkRingsController({} as never, inventory as never);
  controller.inventory(req("me"));
  controller.history(req("me"), "2");
  controller.expired(req("me"));
  controller.recipients(req("me"), { tab: "search", q: "ada", page: "3" });
  expect(inventory.inventory).toHaveBeenCalledWith("me");
  expect(inventory.history).toHaveBeenCalledWith("me", 2);
  expect(inventory.expired).toHaveBeenCalledWith("me", 1);
  expect(inventory.recipients).toHaveBeenCalledWith("me", "search", "ada", 3);
  expect(() => controller.history(req("me"), "-1")).toThrow();
  expect(() => controller.recipients(req("me"), { q: "x".repeat(65) })).toThrow();
});
it("validates explicit gifts without trusting an owner in the request body", () => {
  const service = { giveSelected: vi.fn() };
  const controller = new KinkRingsController(service as never, {} as never);
  const gifts = [{ ringId: "00000000-0000-4000-8000-000000000001", username: "ada" }];
  controller.giveSelected(req("me"), { gifts });
  expect(service.giveSelected).toHaveBeenCalledWith("me", gifts);
  expect(() => controller.giveSelected(req("me"), { gifts, ownerId: "other" })).toThrow();
  expect(() => controller.giveSelected(req("me"), { gifts: [...gifts, ...gifts] })).toThrow();
});
