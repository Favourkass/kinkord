import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));

import { bronzeVerificationApi } from "./bronzeVerification.service";

describe("bronzeVerificationApi", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({});
    post.mockReset().mockResolvedValue({});
  });

  it("loads status, records versioned consent, starts and withdraws", async () => {
    await bronzeVerificationApi.status();
    await bronzeVerificationApi.consent("identity-v3");
    await bronzeVerificationApi.start();
    await bronzeVerificationApi.withdraw();
    expect(get).toHaveBeenCalledWith("/verification/bronze/status");
    expect(post.mock.calls).toEqual([
      ["/verification/bronze/consent", { accepted: true, policyVersion: "identity-v3" }],
      ["/verification/bronze/attempts", {}],
      ["/verification/bronze/consent/withdraw", {}],
    ]);
  });
});
