import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));

import { kycApi } from "./kyc.service";

describe("kycApi", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({});
    post.mockReset().mockResolvedValue({});
  });

  it("sends stage consent and location evidence to their KYC endpoints", async () => {
    await kycApi.status();
    await kycApi.consent("location", "location-v1");
    await kycApi.submitLocation({ latitude: 6.3, longitude: 5.6, accuracyMetres: 12 });
    await kycApi.refreshResidence();
    await kycApi.startFinancial();
    expect(get).toHaveBeenCalledWith("/verification/kyc/status");
    expect(post.mock.calls).toEqual([
      ["/verification/kyc/consents", { category: "location", policyVersion: "location-v1" }],
      ["/verification/kyc/location", { latitude: 6.3, longitude: 5.6, accuracyMetres: 12 }],
      ["/verification/kyc/residence/refresh", {}],
      ["/verification/kyc/financial/attempts", {}],
    ]);
  });
});
