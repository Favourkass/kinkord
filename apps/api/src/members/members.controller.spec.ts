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
  const suggestedForFeed = vi
    .fn()
    .mockResolvedValue({ items: [], show: "women", options: ["women", "men"] });
  const dismissSuggestion = vi.fn().mockResolvedValue({ dismissed: "u2" });
  const controller = new MembersController({
    countries,
    states,
    list,
    suggestedForFeed,
    dismissSuggestion,
  } as unknown as MembersService);
  return { controller, countries, states, list, suggestedForFeed, dismissSuggestion };
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

  it("searches everyone by name or @username, and needs something to look for", async () => {
    const { controller } = makeController();
    const search = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    (controller as unknown as { members: { search: typeof search } }).members.search = search;
    await controller.search(req, { q: " @tega ", page: "2" });
    expect(search).toHaveBeenCalledWith("me", "tega", 2, 20);
    expect(() => controller.search(req, { q: " @ " })).toThrow(BadRequestException);
    expect(() => controller.search(req, {})).toThrow(BadRequestException);
  });

  it("searches by name or @username, and ignores an empty search", async () => {
    const { controller, list } = makeController();
    await controller.list(req, { country: "ng", q: "  @ada " });
    expect(list).toHaveBeenLastCalledWith(
      { country: "NG", q: "ada", sort: "recent", page: 1, limit: 20 },
      "me",
    );
    await controller.list(req, { country: "ng", q: " @ " });
    expect(list).toHaveBeenLastCalledWith(
      { country: "NG", q: undefined, sort: "recent", page: 1, limit: 20 },
      "me",
    );
    expect(() => controller.list(req, { country: "ng", q: "x".repeat(51) })).toThrow(
      BadRequestException,
    );
  });

  it("lists a whole country when no state is given, but an LGA alone is rejected", async () => {
    const { controller, list } = makeController();
    await controller.list(req, { country: "ng" });
    expect(list).toHaveBeenCalledWith({ country: "NG", sort: "recent", page: 1, limit: 20 }, "me");
    expect(() => controller.list(req, { country: "ng", lga: "Asaba" })).toThrow(
      BadRequestException,
    );
    expect(list).toHaveBeenCalledTimes(1);
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

  it("ranks Kinksters Near You for the segment asked for, or the member's default", async () => {
    const { controller, suggestedForFeed } = makeController();
    await controller.suggested(req, {});
    expect(suggestedForFeed).toHaveBeenLastCalledWith("me", 10, undefined);
    await controller.suggested(req, { show: "men", limit: "5" });
    expect(suggestedForFeed).toHaveBeenLastCalledWith("me", 5, "men");
    expect(() => controller.suggested(req, { show: "everyone" })).toThrow(BadRequestException);
    expect(() => controller.suggested(req, { limit: "50" })).toThrow(BadRequestException);
    expect(suggestedForFeed).toHaveBeenCalledTimes(2);
  });

  it("removes a member from the viewer's suggestions, and refuses a blank id", async () => {
    const { controller, dismissSuggestion } = makeController();
    await expect(controller.dismissSuggestion(req, " u2 ")).resolves.toEqual({ dismissed: "u2" });
    expect(dismissSuggestion).toHaveBeenCalledWith("me", "u2");
    expect(() => controller.dismissSuggestion(req, "  ")).toThrow(BadRequestException);
    expect(() => controller.dismissSuggestion(req, "x".repeat(65))).toThrow(BadRequestException);
    expect(dismissSuggestion).toHaveBeenCalledTimes(1);
  });
});
