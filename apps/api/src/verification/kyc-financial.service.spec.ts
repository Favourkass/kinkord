import { beforeEach, describe, expect, it, vi } from "vitest";
import { KycFinancialService, KYC_FINANCIAL_POLICY_VERSION } from "./kyc-financial.service";
import { kycIdentityBinding } from "./kyc-identity-binding";
import type { MonoService } from "./mono.service";
import type { KycRepository } from "./kyc.repository";

function subject() {
  const identityBinding = kycIdentityBinding({
    fullName: "MEMBER NAME",
    dateOfBirth: "1990-02-03",
    gender: "female",
  });
  const repository = {
    hasActiveConsent: vi.fn().mockResolvedValue(true),
    createProviderAttempt: vi.fn().mockResolvedValue({ id: "attempt-1" }),
    failProviderAttempt: vi.fn().mockResolvedValue(undefined),
    attemptByProviderReference: vi
      .fn()
      .mockResolvedValue({ id: "attempt-1", caseUserId: "member-1", provider: "mono" }),
    recordProviderReceipt: vi.fn().mockResolvedValue(undefined),
    financialComparisonSnapshot: vi.fn().mockResolvedValue({ identityBinding }),
    upsertDerivedStageResult: vi.fn().mockResolvedValue(undefined),
  };
  const mono = {
    configured: true,
    verifyWebhook: vi.fn(),
    initiateAccountLink: vi.fn().mockResolvedValue({ url: "https://link.mono.co/link" }),
    identity: vi
      .fn()
      .mockResolvedValue({ fullName: "MEMBER NAME", dateOfBirth: "1990-02-03", gender: "Female" }),
  };
  return {
    repository,
    mono,
    service: new KycFinancialService(
      repository as unknown as KycRepository,
      mono as unknown as MonoService,
    ),
  };
}

describe("KycFinancialService", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "test-only-financial-identity-secret-long-enough"));
  it("requires separate financial consent before creating a hosted link", async () => {
    const { repository, mono, service } = subject();
    await expect(
      service.start({ id: "member-1", name: "Member", email: "member@example.test" }),
    ).resolves.toEqual({ url: "https://link.mono.co/link" });
    expect(repository.hasActiveConsent).toHaveBeenCalledWith(
      "member-1",
      "financial",
      KYC_FINANCIAL_POLICY_VERSION,
    );
    expect(repository.createProviderAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-1",
        stage: "financial",
        provider: "mono",
        providerReference: expect.stringMatching(/^mono:/),
      }),
    );
    expect(mono.initiateAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Member", email: "member@example.test" }),
    );
  });

  it("records only a derived financial pass after a verified Mono identity webhook", async () => {
    const { repository, mono, service } = subject();
    await service.webhook(
      {
        event: "mono.events.account_updated",
        data: {
          account: { _id: "account_12345678" },
          meta: { ref: "mono:reference-1", data_status: "AVAILABLE", retrieved_data: ["identity"] },
        },
      },
      "valid-secret",
    );
    expect(mono.verifyWebhook).toHaveBeenCalledWith("valid-secret");
    expect(mono.identity).toHaveBeenCalledWith("account_12345678");
    expect(repository.upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "financial",
        status: "passed",
        summary: {
          accountLinked: true,
          financialIdentityAvailable: true,
          identityMatchesKyc: true,
        },
      }),
    );
    const stored = JSON.stringify(repository.upsertDerivedStageResult.mock.calls);
    expect(stored).not.toContain("account_12345678");
    expect(stored).not.toContain("MEMBER NAME");
  });

  it("routes a mismatch to review instead of automatically awarding full KYC", async () => {
    const { repository, mono, service } = subject();
    mono.identity.mockResolvedValue({
      fullName: "OTHER MEMBER",
      dateOfBirth: "1991-02-03",
      gender: "Male",
    });
    await service.webhook(
      {
        event: "mono.events.account_updated",
        data: {
          account: { _id: "account_12345678" },
          meta: { ref: "mono:reference-1", data_status: "partial", retrieved_data: ["identity"] },
        },
      },
      "valid-secret",
    );
    expect(repository.upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "financial", status: "under_review" }),
    );
  });

  it("refuses a bank connection when the protected identity reference is unavailable", async () => {
    const { repository, service } = subject();
    repository.financialComparisonSnapshot.mockResolvedValue(null);
    await expect(
      service.start({ id: "member-1", name: "Member", email: "member@example.test" }),
    ).rejects.toThrow("Complete current identity and profile-photo verification");
    expect(repository.createProviderAttempt).not.toHaveBeenCalled();
  });

  it("treats duplicate account_updated deliveries as idempotent receipts", async () => {
    const { repository, mono, service } = subject();
    const payload = {
      event: "mono.events.account_updated",
      data: {
        account: { _id: "account_12345678" },
        meta: { ref: "mono:reference-1", data_status: "AVAILABLE", retrieved_data: ["identity"] },
      },
    };
    await service.webhook(payload, "valid-secret");
    await service.webhook(payload, "valid-secret");
    expect(repository.recordProviderReceipt).toHaveBeenCalledTimes(2);
    expect(repository.upsertDerivedStageResult).toHaveBeenCalledTimes(2);
    expect(mono.identity).toHaveBeenCalledTimes(2);
  });
});
