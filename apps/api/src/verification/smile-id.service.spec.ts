import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmileIdService } from "./smile-id.service";

describe("SmileIdService", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports whether every required integration setting is present", () => {
    const service = new SmileIdService();
    expect(service.configured).toBe(false);
    vi.stubEnv("SMILE_ID_PARTNER_ID", "partner");
    vi.stubEnv("SMILE_ID_API_KEY", "key");
    vi.stubEnv("SMILE_ID_CALLBACK_URL", "https://api.example/webhooks/smile-id");
    vi.stubEnv("SMILE_ID_POLICY_URL", "https://example.com/verification/privacy");
    vi.stubEnv("SMILE_ID_ENVIRONMENT", "live");
    expect(service.configured).toBe(true);
    expect(service.environment).toBe("live");
  });

  it("fails closed before calling Smile ID when configuration is incomplete", async () => {
    const service = new SmileIdService();
    await expect(service.webToken("user-1", "job-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.jobResults("user-1", "job-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(() => service.verifyCallback({})).toThrow(ServiceUnavailableException);
  });
});
