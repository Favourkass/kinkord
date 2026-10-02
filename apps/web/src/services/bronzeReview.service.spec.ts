import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));

import { bronzeReviewApi } from "./bronzeReview.service";

describe("bronzeReviewApi", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({ status: "verified" });
  });

  it("uses the protected queue and URL-encodes review identifiers", async () => {
    await bronzeReviewApi.list();
    await bronzeReviewApi.decide("review/1", {
      decision: "approve",
      profileFaceMatches: true,
      evidenceReference: "didit-1",
      reason: "Evidence confirms the member.",
    });
    expect(get).toHaveBeenCalledWith("/verification/bronze/reviews");
    expect(post).toHaveBeenCalledWith(
      "/verification/bronze/reviews/review%2F1/decision",
      expect.objectContaining({ decision: "approve", profileFaceMatches: true }),
    );
  });
});
