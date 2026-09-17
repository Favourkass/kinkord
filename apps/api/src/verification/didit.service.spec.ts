import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { DiditService } from "./didit.service";
import { interpretDiditResult } from "./bronze-policy";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Didit adapter", () => {
  it("requires the server-side key, published workflow, return URL and privacy notice", () => {
    const service = new DiditService();
    expect(service.configured).toBe(false);
    vi.stubEnv("DIDIT_API_KEY", "test-key");
    vi.stubEnv("DIDIT_WORKFLOW_ID", "workflow-1");
    vi.stubEnv("DIDIT_RETURN_URL", "http://localhost:3000/settings/verification/bronze");
    vi.stubEnv("BRONZE_POLICY_URL", "https://example.test/privacy");
    expect(service.configured).toBe(true);
  });

  it("creates a hosted session without exposing the API key in the result", async () => {
    vi.stubEnv("DIDIT_API_KEY", "test-key");
    vi.stubEnv("DIDIT_WORKFLOW_ID", "workflow-1");
    vi.stubEnv("DIDIT_RETURN_URL", "http://localhost:3000/settings/verification/bronze");
    vi.stubEnv("BRONZE_POLICY_URL", "https://example.test/privacy");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      session_id: "session-1", url: "https://verify.didit.me/session/token", vendor_data: "u1",
    }) });
    vi.stubGlobal("fetch", fetchMock);
    const session = await new DiditService().createSession("u1");
    expect(session).toEqual({ sessionId: "session-1", url: "https://verify.didit.me/session/token" });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/v3/session/"), expect.objectContaining({
      headers: expect.objectContaining({ "x-api-key": "test-key" }),
    }));
  });

  it("authenticates exact webhook bytes and rejects stale or altered requests", () => {
    vi.stubEnv("DIDIT_WEBHOOK_SECRET", "webhook-test-secret");
    const service = new DiditService();
    const body = Buffer.from('{"session_id":"session-1"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "webhook-test-secret").update(body).digest("hex");
    expect(() => service.verifyWebhook(body, signature, timestamp)).not.toThrow();
    expect(() => service.verifyWebhook(Buffer.from("{}"), signature, timestamp)).toThrow(UnauthorizedException);
    expect(() => service.verifyWebhook(body, signature, "1")).toThrow(UnauthorizedException);
  });

  it("never treats a top-level approval as all Bronze checks", () => {
    const result = interpretDiditResult({ status: "Approved", id_verifications: [
      { status: "Approved", date_of_birth: "1998-04-02", gender: "Female", issuing_state: "NGA" },
    ], liveness_checks: [{ status: "Approved" }], face_matches: [{ status: "Approved" }] }, "NG");
    expect(result.terminal).toBe(true);
    expect(result.governmentId).toBe(false); // Nigerian registry validation absent
    expect(result.liveness).toBe(true);
    expect(result.idFace).toBe(true);
  });
});
