import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { PushController } from "./push.controller";
import type { PushService } from "./push.service";

const req = {
  user: { id: "u1" },
  headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14)" },
} as unknown as AuthedRequest;

const SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BNcRdreALRFX", auth: "tBHItJI5svbpez7KI4CCXg" },
};

function make() {
  const push = {
    publicKey: vi.fn(async () => "PUB"),
    subscribe: vi.fn(async () => undefined),
    unsubscribe: vi.fn(async () => undefined),
    sendTo: vi.fn(async () => 2),
  };
  return { controller: new PushController(push as unknown as PushService), push };
}

describe("PushController", () => {
  it("hands out the key browsers subscribe with", async () => {
    await expect(make().controller.key()).resolves.toEqual({ publicKey: "PUB" });
  });

  it("remembers this member's device with its browser", async () => {
    const { controller, push } = make();
    await expect(controller.subscribe(req, SUB)).resolves.toEqual({ ok: true });
    expect(push.subscribe).toHaveBeenCalledWith("u1", SUB, "Mozilla/5.0 (Linux; Android 14)");
  });

  it("refuses an endpoint that isn't https, or keys that aren't base64url", async () => {
    const { controller, push } = make();
    await expect(
      controller.subscribe(req, { ...SUB, endpoint: "http://evil.example/x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.subscribe(req, { ...SUB, keys: { p256dh: "not base64!", auth: "a" } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(push.subscribe).not.toHaveBeenCalled();
  });

  it("forgets the device for this member only", async () => {
    const { controller, push } = make();
    await controller.unsubscribe(req, { endpoint: SUB.endpoint });
    expect(push.unsubscribe).toHaveBeenCalledWith("u1", SUB.endpoint);
  });

  it("sends a test notification to the member's own devices", async () => {
    const { controller, push } = make();
    await expect(controller.test(req)).resolves.toEqual({ sent: 2 });
    expect(push.sendTo).toHaveBeenCalledWith("u1", expect.objectContaining({ tag: "test" }));
  });
});
