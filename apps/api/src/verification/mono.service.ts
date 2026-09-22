import { timingSafeEqual } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

const MONO_API = "https://api.withmono.com/v2";

export interface MonoIdentity {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function monoAccountId(value: unknown) {
  const id = text(value);
  return id && /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : null;
}

@Injectable()
export class MonoService {
  private get secretKey() { return process.env.MONO_SECRET_KEY?.trim() ?? ""; }
  private get webhookSecret() { return process.env.MONO_WEBHOOK_SECRET?.trim() ?? ""; }
  private get redirectUrl() { return process.env.MONO_REDIRECT_URL?.trim() ?? ""; }

  get configured() {
    return process.env.MONO_FINANCIAL_KYC_ENABLED === "true" && Boolean(this.secretKey && this.webhookSecret && this.redirectUrl);
  }

  private headers() {
    return { accept: "application/json", "content-type": "application/json", "mono-sec-key": this.secretKey };
  }

  async initiateAccountLink(input: { name: string; email: string; reference: string }) {
    if (!this.configured) throw new ServiceUnavailableException("Financial KYC is not configured yet.");
    try {
      const response = await fetch(`${MONO_API}/accounts/initiate`, {
        method: "POST", headers: this.headers(),
        body: JSON.stringify({
          customer: { name: input.name, email: input.email }, meta: { ref: input.reference },
          scope: "auth", redirect_url: this.redirectUrl,
        }),
        signal: AbortSignal.timeout(10_000), redirect: "error",
      });
      if (!response.ok) throw new Error("Mono link initiation failed");
      const body = await response.json() as { data?: { mono_url?: unknown; meta?: { ref?: unknown } } };
      const url = text(body.data?.mono_url);
      if (!url || !/^https:\/\/link\.mono\.co\//.test(url) || body.data?.meta?.ref !== input.reference) {
        throw new Error("Mono returned an invalid account-link URL");
      }
      return { url };
    } catch {
      throw new ServiceUnavailableException("Financial KYC is temporarily unavailable. Please try again.");
    }
  }

  async identity(accountId: unknown): Promise<MonoIdentity> {
    if (!this.configured) throw new ServiceUnavailableException("Financial KYC is not configured yet.");
    const id = monoAccountId(accountId);
    if (!id) throw new ServiceUnavailableException("Mono did not provide a usable linked-account reference.");
    try {
      const response = await fetch(`${MONO_API}/accounts/${encodeURIComponent(id)}/identity`, {
        headers: this.headers(), signal: AbortSignal.timeout(10_000), redirect: "error",
      });
      if (!response.ok) throw new Error("Mono identity lookup failed");
      const body = await response.json() as { data?: Record<string, unknown> };
      return {
        fullName: text(body.data?.full_name), dateOfBirth: text(body.data?.dob), gender: text(body.data?.gender),
      };
    } catch {
      throw new ServiceUnavailableException("Financial identity information is temporarily unavailable. Please try again later.");
    }
  }

  verifyWebhook(received: string | undefined) {
    if (!this.configured || !received) throw new UnauthorizedException("Invalid Mono webhook secret.");
    const expected = Buffer.from(this.webhookSecret, "utf8");
    const actual = Buffer.from(received, "utf8");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException("Invalid Mono webhook secret.");
    }
  }
}
