import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { ChatController } from "./chat.controller";
import type { ChatService } from "./chat.service";

const req = {
  user: { id: "u1", email: "u1@example.com", emailVerified: true },
} as unknown as AuthedRequest;

function make() {
  const chat = {
    startDm: vi.fn(async () => "c1"),
    history: vi.fn(async () => []),
    sendMessage: vi.fn(async () => ({ id: "m1" })),
    markRead: vi.fn(async () => undefined),
    allowance: vi.fn(async () => ({ newChatsPerDay: 1, usedToday: 0, resetsAt: "x" })),
  };
  return { controller: new ChatController(chat as unknown as ChatService), chat };
}

describe("ChatController", () => {
  it("opens a thread with the member named in the body", async () => {
    const { controller, chat } = make();
    await expect(controller.start(req, { userId: "u2" })).resolves.toEqual({
      conversationId: "c1",
    });
    // The whole session user: their verified email decides their limits.
    expect(chat.startDm).toHaveBeenCalledWith(req.user, "u2");
  });

  it("reports today's new-chat allowance for the signed-in member", async () => {
    const { controller, chat } = make();
    await expect(controller.allowance(req)).resolves.toEqual({
      newChatsPerDay: 1,
      usedToday: 0,
      resetsAt: "x",
    });
    expect(chat.allowance).toHaveBeenCalledWith(req.user);
  });

  it("refuses an empty message before the service sees it", async () => {
    const { controller, chat } = make();
    await expect(controller.send(req, "c1", { body: "   " })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("refuses attachments until there is a safe way to upload them", async () => {
    const { controller, chat } = make();
    await controller.send(req, "c1", { body: "hi", media: [{ key: "posts/u9/secret.jpg" }] });
    // Unknown fields are dropped: only the text reaches the service.
    expect(chat.sendMessage).toHaveBeenCalledWith(req.user, "c1", { body: "hi" });
  });

  it("defaults the page size and passes the polling cursor", async () => {
    const { controller, chat } = make();
    const after = "11111111-1111-4111-8111-111111111111";
    await controller.history(req, "c1", { after });
    expect(chat.history).toHaveBeenCalledWith("u1", "c1", { after, limit: 50 });
  });

  it("won't take both cursors at once", async () => {
    const { controller } = make();
    const id = "11111111-1111-4111-8111-111111111111";
    await expect(controller.history(req, "c1", { before: id, after: id })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("marks a message read", async () => {
    const { controller, chat } = make();
    const messageId = "11111111-1111-4111-8111-111111111111";
    await expect(controller.read(req, "c1", { messageId })).resolves.toEqual({ ok: true });
    expect(chat.markRead).toHaveBeenCalledWith("u1", "c1", messageId);
  });
});
