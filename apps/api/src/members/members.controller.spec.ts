import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { type AuthedRequest } from "../auth/auth.guard";
import { MembersController } from "./members.controller";
import { type MembersService } from "./members.service";

const req = { user: { id: "me", name: "Me" } } as unknown as AuthedRequest;

const makeController = () => {
  const countries = vi.fn().mockResolvedValue([]);
  const states = vi.fn().mockResolvedValue([]);
  const list = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  const controller = new MembersController({
    countries,
    states,
    list,
  } as unknown as MembersService);
  return { controller, countries, states, list };
};

describe("MembersController", () => {
  it("rejects a malformed country code on /members/states", () => {
    const { controller, states } = makeController();
    expect(() => controller.states({ country: "Nigeria" })).toThrow(BadRequestException);
    expect(states).not.toHaveBeenCalled();
  });

  it("normalizes the country code and delegates", async () => {
    const { controller, states } = makeController();
    await controller.states({ country: " ng " });
    expect(states).toHaveBeenCalledWith("NG");
  });

  it("applies list defaults (recent, page 1, 20 rows) and passes the viewer id", async () => {
    const { controller, list } = makeController();
    await controller.list(req, { country: "ng", state: "Delta" });
    expect(list).toHaveBeenCalledWith(
      { country: "NG", state: "Delta", sort: "recent", page: 1, limit: 20 },
      "me",
    );
  });

  it("coerces paging from query strings and forwards the LGA filter", async () => {
    const { controller, list } = makeController();
    await controller.list(req, {
      country: "NG",
      state: "Delta",
      lga: "Asaba",
      sort: "followers",
      page: "2",
      limit: "10",
    });
    expect(list).toHaveBeenCalledWith(
      { country: "NG", state: "Delta", lga: "Asaba", sort: "followers", page: 2, limit: 10 },
      "me",
    );
  });

  it("refuses an unknown sort or an oversized page", () => {
    const { controller, list } = makeController();
    expect(() => controller.list(req, { country: "NG", state: "Delta", sort: "hot" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.list(req, { country: "NG", state: "Delta", limit: "500" })).toThrow(
      BadRequestException,
    );
    expect(list).not.toHaveBeenCalled();
  });
});
