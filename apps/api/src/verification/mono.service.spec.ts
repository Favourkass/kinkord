import { afterEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { MonoService } from "./mono.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configure() {
  vi.stubEnv("MONO_FINANCIAL_KYC_ENABLED", "true");
  vi.stubEnv("MONO_SECRET_KEY", "test_sk_mono");
  vi.stubEnv("MONO_WEBHOOK_SECRET", "mono-webhook-secret");
  vi.stubEnv("MONO_REDIRECT_URL", "http://localhost:3000/settings/kyc");
}

describe("MonoService", () => {
  it("stays disabled until the server secret, webhook secret and redirect URL are all configured", () => {
    configure();
    expect(new MonoService().configured).toBe(true);
    vi.stubEnv("MONO_WEBHOOK_SECRET", "");
    expect(new MonoService().configured).toBe(false);
  });

  it("creates a hosted Mono link without returning its secret key", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          mono_url: "https://link.mono.co/secure-link",
          meta: { ref: "mono:reference-1" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new MonoService().initiateAccountLink({
        name: "Member",
        email: "member@example.test",
        reference: "mono:reference-1",
      }),
    ).resolves.toEqual({ url: "https://link.mono.co/secure-link" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.withmono.com/v2/accounts/initiate",
      expect.objectContaining({
        headers: expect.objectContaining({ "mono-sec-key": "test_sk_mono" }),
      }),
    );
  });

  it("rejects a provider link outside Mono's hosted domain", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            mono_url: "https://attacker.example/link",
            meta: { ref: "mono:reference-1" },
          },
        }),
      }),
    );
    await expect(
      new MonoService().initiateAccountLink({
        name: "Member",
        email: "member@example.test",
        reference: "mono:reference-1",
      }),
    ).rejects.toThrow("Financial KYC is temporarily unavailable");
  });

  it("uses a timing-safe webhook-secret comparison", () => {
    configure();
    const service = new MonoService();
    expect(() => service.verifyWebhook("mono-webhook-secret")).not.toThrow();
    expect(() => service.verifyWebhook("other-secret")).toThrow(UnauthorizedException);
  });
});
