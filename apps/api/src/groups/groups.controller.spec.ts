import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { AdminGroupsController, GroupsController } from "./groups.controller";
import type { GroupsService } from "./groups.service";

const req = {
  user: { id: "me", email: "me@example.test", emailVerified: true },
} as unknown as AuthedRequest;

function make() {
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    update: vi.fn(),
    join: vi.fn(),
    members: vi.fn(),
    setRole: vi.fn(),
    threads: vi.fn(),
    createThread: vi.fn(),
    setPinned: vi.fn(),
    adminList: vi.fn(),
    adminArchive: vi.fn(),
  };
  return {
    controller: new GroupsController(service as unknown as GroupsService),
    admin: new AdminGroupsController(service as unknown as GroupsService),
    service,
  };
}

describe("GroupsController", () => {
  it("reads the directory's view, search and page, with sensible defaults", () => {
    const { controller, service } = make();
    controller.list(req, {});
    expect(service.list).toHaveBeenLastCalledWith("me", { view: "popular", page: 1 });
    controller.list(req, { view: "near", q: " munch ", category: "local", page: "2" });
    expect(service.list).toHaveBeenLastCalledWith("me", {
      view: "near",
      q: "munch",
      category: "local",
      page: 2,
    });
    expect(() => controller.list(req, { view: "everyone" })).toThrow(BadRequestException);
  });

  it("accepts a new group's own fields only, and fills the defaults", () => {
    const { controller, service } = make();
    controller.create(req, {
      name: "Lagos Munch",
      description: "A monthly munch in Lagos.",
      category: "local",
      country: "ng",
      state: "Lagos",
    });
    expect(service.create).toHaveBeenCalledWith(req.user, {
      name: "Lagos Munch",
      description: "A monthly munch in Lagos.",
      rules: null,
      category: "local",
      privacy: "open",
      country: "NG",
      state: "Lagos",
    });
    for (const body of [
      { name: "x", description: "Too short a name for sure.", category: "local" },
      { name: "Fine name", description: "A fine description.", category: "everything" },
      { name: "Fine name", description: "A fine description.", category: "local", owner: "me" },
    ])
      expect(() => controller.create(req, body)).toThrow(BadRequestException);
  });

  it("never lets an edit change the privacy members joined under", () => {
    const { controller } = make();
    expect(() => controller.update(req, "lagos-munch", { privacy: "closed" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.update(req, "lagos-munch", {})).toThrow(BadRequestException);
  });

  it("refuses addresses, member ids and discussion ids that can't be real", () => {
    const { controller, service } = make();
    expect(() => controller.detail(req, "../admin")).toThrow(BadRequestException);
    expect(() => controller.setRole(req, "lagos-munch", "a b", { role: "moderator" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.setRole(req, "lagos-munch", "abc", { role: "owner" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.pin(req, "lagos-munch", "not-a-uuid", { pinned: true })).toThrow(
      BadRequestException,
    );
    controller.detail(req, "Lagos-Munch");
    expect(service.detail).toHaveBeenCalledWith("me", "lagos-munch");
  });

  it("checks a new discussion's title and body", () => {
    const { controller, service } = make();
    expect(() => controller.createThread(req, "lagos-munch", { title: "Hi", body: "x" })).toThrow(
      BadRequestException,
    );
    controller.createThread(req, "lagos-munch", { title: "First munch", body: "Who's coming?" });
    expect(service.createThread).toHaveBeenCalledWith("me", "lagos-munch", {
      title: "First munch",
      body: "Who's coming?",
      media: [],
    });
  });

  it("requires a signed-in member everywhere, and an admin for Kinkord's own list", async () => {
    const { GUARDS_METADATA } = await import("@nestjs/common/constants");
    const { AuthGuard } = await import("../auth/auth.guard");
    const { AdminGuard } = await import("../moderation/admin.guard");
    expect(Reflect.getMetadata(GUARDS_METADATA, GroupsController)).toContain(AuthGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminGroupsController)).toEqual([
      AuthGuard,
      AdminGuard,
    ]);
    const { admin, service } = make();
    admin.archive(req, "9b2c5f1e-6c2a-4b1e-9a7e-1d2c3b4a5f60", { archived: true });
    expect(service.adminArchive).toHaveBeenCalledWith(
      "me",
      "9b2c5f1e-6c2a-4b1e-9a7e-1d2c3b4a5f60",
      true,
    );
  });
});
