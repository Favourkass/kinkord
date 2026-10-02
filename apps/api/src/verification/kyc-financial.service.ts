import { randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { MonoService } from "./mono.service";
import { KycRepository } from "./kyc.repository";
import { identityBindingsMatch, kycIdentityBinding } from "./kyc-identity-binding";

export const KYC_FINANCIAL_POLICY_VERSION = "kyc-financial-mono-2026-09-22-v1";

const webhookSchema = z.object({
  event: z.string().trim(),
  data: z.object({
    id: z.string().trim().optional(),
    account: z.object({ _id: z.string().trim().optional() }).optional(),
    meta: z
      .object({
        ref: z.string().trim().optional(),
        data_status: z.string().trim().optional(),
        retrieved_data: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});

function comparable(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ") ?? "";
}

@Injectable()
export class KycFinancialService {
  constructor(
    private readonly repository: KycRepository,
    private readonly mono: MonoService,
  ) {}

  get enabled() {
    return this.mono.configured;
  }

  async start(user: { id: string; name: string; email: string }) {
    if (!this.enabled) throw new ServiceUnavailableException("Financial KYC is not enabled.");
    if (
      !(await this.repository.hasActiveConsent(user.id, "financial", KYC_FINANCIAL_POLICY_VERSION))
    ) {
      throw new ForbiddenException(
        "Financial-verification consent is required before connecting a bank account.",
      );
    }
    const verifiedIdentity = await this.repository.financialComparisonSnapshot(user.id);
    if (!verifiedIdentity) {
      throw new ForbiddenException(
        "Complete current identity and profile-photo verification before connecting a bank account.",
      );
    }

    const reference = `mono:${randomUUID()}`;
    const attempt = await this.repository.createProviderAttempt({
      userId: user.id,
      stage: "financial",
      provider: "mono",
      providerReference: reference,
    });
    if (!attempt) throw new ConflictException("A financial verification is already in progress.");
    try {
      return await this.mono.initiateAccountLink({ name: user.name, email: user.email, reference });
    } catch (error) {
      await this.repository.failProviderAttempt(attempt.id, "MONO_LINK_CREATION_FAILED");
      throw error;
    }
  }

  /** Processes only allow-listed webhook fields and never persists Mono account data. */
  async webhook(body: unknown, secret: string | undefined) {
    this.mono.verifyWebhook(secret);
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) return { received: true };
    const event = parsed.data.event;
    const reference = parsed.data.data.meta?.ref;
    if (!reference?.startsWith("mono:")) return { received: true };
    const attempt = await this.repository.attemptByProviderReference(reference, "financial");
    if (!attempt || attempt.provider !== "mono") return { received: true };
    await this.repository.recordProviderReceipt({
      userId: attempt.caseUserId,
      stage: "financial",
      provider: "mono",
      event,
    });

    if (event !== "mono.events.account_updated") return { received: true };
    const dataStatus = comparable(parsed.data.data.meta?.data_status);
    const retrieved = new Set(
      (parsed.data.data.meta?.retrieved_data ?? []).map((value) => comparable(value)),
    );
    if (!((dataStatus === "available" || dataStatus === "partial") && retrieved.has("identity"))) {
      await this.repository.upsertDerivedStageResult({
        userId: attempt.caseUserId,
        attemptId: attempt.id,
        stage: "financial",
        provider: "mono",
        providerReference: reference,
        status: "under_review",
        summary: { accountLinked: true, financialIdentityAvailable: false },
        reasonCodes: ["MONO_FINANCIAL_IDENTITY_UNAVAILABLE"],
      });
      return { received: true };
    }

    const accountId = parsed.data.data.account?._id ?? parsed.data.data.id;
    const [providerIdentity, comparison] = await Promise.all([
      this.mono.identity(accountId),
      this.repository.financialComparisonSnapshot(attempt.caseUserId),
    ]);
    const providerBinding = kycIdentityBinding({
      fullName: providerIdentity.fullName ?? "",
      dateOfBirth: providerIdentity.dateOfBirth ?? "",
      gender: providerIdentity.gender ?? "",
    });
    const identityComplete = Boolean(providerBinding);
    const identityMatchesKyc = identityBindingsMatch(comparison?.identityBinding, providerBinding);
    const passed = identityComplete && identityMatchesKyc;
    await this.repository.upsertDerivedStageResult({
      userId: attempt.caseUserId,
      attemptId: attempt.id,
      stage: "financial",
      provider: "mono",
      providerReference: reference,
      status: passed ? "passed" : "under_review",
      summary: {
        accountLinked: true,
        financialIdentityAvailable: identityComplete,
        identityMatchesKyc,
      },
      reasonCodes: passed ? [] : ["MONO_FINANCIAL_IDENTITY_REVIEW_REQUIRED"],
    });
    return { received: true };
  }
}
