import { expect, it, vi } from "vitest";
import { GroupsController } from "./groups.controller";
const ID = "00000000-0000-4000-8000-000000000001";
const req = { user: { id: "viewer" } } as never;
it("creates only for the signed-in member and validates invites", () => {
  const groups = { create: vi.fn() };
  const controller = new GroupsController(groups as never);
  controller.create(req, { name: "Friends", friends: ["friend"], ownerId: "other" });
  expect(groups.create).toHaveBeenCalledWith("viewer", { name: "Friends", friends: ["friend"] });
  expect(() => controller.create(req, { name: "" })).toThrow();
});
it("validates group and post IDs before forwarding a share", () => {
  const groups = { share: vi.fn() };
  const controller = new GroupsController(groups as never);
  controller.share(req, ID, { postId: ID, caption: " Hello " });
  expect(groups.share).toHaveBeenCalledWith("viewer", ID, { postId: ID, caption: "Hello" });
  expect(() => controller.share(req, "bad", { postId: ID })).toThrow();
  expect(() => controller.share(req, ID, { postId: ID, caption: "x".repeat(2001) })).toThrow();
});
it("rejects invalid pagination and excessive invitations", () => {
  const controller = new GroupsController({} as never);
  expect(() => controller.feed(req, ID, "0")).toThrow();
  expect(() => controller.invite(req, ID, { friends: Array(51).fill("friend") })).toThrow();
});
