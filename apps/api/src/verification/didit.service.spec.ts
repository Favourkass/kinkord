import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { DiditService } from "./didit.service";
import { parseVerificationSettings, VerificationConfig } from "./verification-config";

afterEach(() => vi.unstubAllGlobals());

const settings = (over: Record<string, unknown> = {}) =>
  parseVerificationSettings({
    enabled: true,
    policyUrl: "https://kinkord.test/privacy/verification",
    returnUrl: "https://kinkord.test/settings/verification",
    diditApiKey: "test-key",
    diditWebhookSecret: "webhook-test-secret",
    diditWorkflowId: "workflow-1",
    diditMode: "live",
    bindingSecret: "b".repeat(40),
    ...over,
  });
const didit = (over: Record<string, unknown> = {}, production = false) =>
  new DiditService(VerificationConfig.fixed(settings(over), production));

const session = {
  ok: true,
  json: async () => ({
    session_id: "session-1",
    url: "https://verify.didit.me/session/token",
    vendor_data: "u1",
  }),
};

describe("Didit adapter", () => {
  it("is only offered once switched on with a notice, keys, workflow and binding key", () => {
    expect(didit().configured).toBe(true);
    expect(didit({ enabled: false }).configured).toBe(false);
    expect(didit({ policyUrl: "" }).configured).toBe(false);
    expect(didit({ diditWebhookSecret: "" }).configured).toBe(false);
    expect(didit({ bindingSecret: "short" }).configured).toBe(false);
  });

  it("never runs sandbox checks in production", () => {
    expect(didit({ diditMode: "sandbox" }, true).configured).toBe(false);
    expect(didit({ diditMode: "sandbox" }, false).configured).toBe(true);
  });

  it("creates a hosted session that returns to Kinkord, without exposing the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(session);
    vi.stubGlobal("fetch", fetchMock);
    await expect(didit().createSession("u1")).resolves.toEqual({
      sessionId: "session-1",
      url: "https://verify.didit.me/session/token",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toEqual({
      workflow_id: "workflow-1",
      callback: "https://kinkord.test/settings/verification",
      vendor_data: "u1",
    });
  });

  it("erases a session at Didit, face templates included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    await didit().deleteSession("session-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://verification.didit.me/v3/session/session-1/delete/");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({
      retain_face_embeddings: false,
      deletion_instruction: "privacy_erasure",
    });
    // Already gone counts as erased; anything else is reported.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(didit().deleteSession("gone")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(didit().deleteSession("x")).rejects.toThrow("Didit deletion failed");
  });

  it("authenticates exact webhook bytes and rejects stale or altered requests", () => {
    const service = didit();
    const body = Buffer.from('{"session_id":"session-1"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "webhook-test-secret").update(body).digest("hex");
    expect(service.verifyWebhook(body, undefined, signature, timestamp)).toBe(body);
    expect(() => service.verifyWebhook(Buffer.from("{}"), undefined, signature, timestamp)).toThrow(
      UnauthorizedException,
    );
    expect(() => service.verifyWebhook(body, undefined, signature, "1")).toThrow(
      UnauthorizedException,
    );
  });

  it("accepts Didit's canonical V2 signature", () => {
    const body = Buffer.from('{"z":1,"name":"José","nested":{"b":2,"a":1}}');
    const canonical = Buffer.from('{"name":"José","nested":{"a":1,"b":2},"z":1}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "webhook-test-secret").update(canonical).digest("hex");
    expect(() => didit().verifyWebhook(body, signature, undefined, timestamp)).not.toThrow();
  });

  it("answers a body that isn't raw JSON bytes with a bad request, not an error", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() => didit().verifyWebhook(undefined, "x", "x", timestamp)).toThrow(
      BadRequestException,
    );
    expect(() => didit().verifyWebhook({ session_id: "s" }, "x", "x", timestamp)).toThrow(
      BadRequestException,
    );
    expect(() => didit().verifyWebhook(Buffer.alloc(600 * 1024, 32), "x", "x", timestamp)).toThrow(
      BadRequestException,
    );
  });

  it("refuses every callback while no webhook secret is set", () => {
    const body = Buffer.from("{}");
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() =>
      didit({ diditWebhookSecret: "" }).verifyWebhook(body, "a", "b", timestamp),
    ).toThrow(UnauthorizedException);
  });
});
