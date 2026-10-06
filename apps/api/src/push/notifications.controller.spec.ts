import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { NotificationsController } from "./notifications.controller";
const req = { user: { id: "member" } } as AuthedRequest;
const ID = "00000000-0000-4000-8000-000000000001";
function make() {
  const inbox = {
    list: vi.fn(),
    unreadCount: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn(),
    delete: vi.fn(),
    counts: vi.fn(),
  };
  return { controller: new NotificationsController(inbox as never), inbox };
}
describe("NotificationsController", () => {
  it("uses the session's recipient, ignoring supplied identities", () => {
    const { controller, inbox } = make();
    controller.list(req, { unread: "true", cursor: "cursor", userId: "other" });
    expect(inbox.list).toHaveBeenCalledWith("member", {
      cursor: "cursor",
      unreadOnly: true,
      type: undefined,
      q: undefined,
    });
    controller.unreadCount(req);
    controller.readAll(req);
    controller.read(req, ID);
    expect(inbox.unreadCount).toHaveBeenCalledWith("member");
    expect(inbox.readAll).toHaveBeenCalledWith("member");
    expect(inbox.read).toHaveBeenCalledWith("member", ID);
  });
  it("passes a search on, trimmed, and treats a blank one as none", () => {
    const { controller, inbox } = make();
    controller.list(req, { q: "  raven " });
    expect(inbox.list).toHaveBeenLastCalledWith("member", expect.objectContaining({ q: "raven" }));
    controller.list(req, { q: "   " });
    expect(inbox.list).toHaveBeenLastCalledWith(
      "member",
      expect.objectContaining({ q: undefined }),
    );
    expect(() => controller.list(req, { q: "x".repeat(65) })).toThrow("Invalid notification query");
  });
  it("rejects malformed ids and query parameters", () => {
    const { controller, inbox } = make();
    expect(() => controller.read(req, "not-an-id")).toThrow("Invalid notification id");
    expect(() => controller.list(req, { unread: "maybe" })).toThrow("Invalid notification query");
    expect(inbox.read).not.toHaveBeenCalled();
    expect(inbox.list).not.toHaveBeenCalled();
  });
});

it("deletes for the session recipient and refuses a malformed id", () => {
  const { controller, inbox } = make();
  controller.delete(req, ID);
  expect(inbox.delete).toHaveBeenCalledWith("member", ID);
  expect(() => controller.delete(req, "bad-id")).toThrow();
});
