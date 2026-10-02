import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));

import { kycReviewApi } from "./kycReview.service";

describe("kycReviewApi", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({ status: "passed" });
  });

  it("uses the KYC review endpoints and URL-encodes identifiers", async () => {
    await kycReviewApi.list();
    await kycReviewApi.decide("case/1", {
      decision: "approve",
      evidenceReference: "provider-1",
      reason: "Provider evidence is consistent.",
    });
    expect(get).toHaveBeenCalledWith("/verification/kyc/reviews");
    expect(post).toHaveBeenCalledWith(
      "/verification/kyc/reviews/case%2F1/decision",
      expect.objectContaining({ decision: "approve" }),
    );
  });
});
