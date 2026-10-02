import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));

import { bronzeVerificationApi } from "./bronzeVerification.service";

describe("bronzeVerificationApi", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({});
    post.mockReset().mockResolvedValue({});
  });

  it("loads status, records versioned consent and starts an attempt", async () => {
    await bronzeVerificationApi.status();
    await bronzeVerificationApi.consent("identity-v2");
    await bronzeVerificationApi.start();
    expect(get).toHaveBeenCalledWith("/verification/bronze/status");
    expect(post.mock.calls).toEqual([
      ["/verification/bronze/consent", { accepted: true, policyVersion: "identity-v2" }],
      ["/verification/bronze/attempts", {}],
    ]);
  });
});
