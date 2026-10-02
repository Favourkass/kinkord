// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, list, decide } = vi.hoisted(() => ({
  replace: vi.fn(),
  list: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/bronzeReview.service", () => ({
  bronzeReviewApi: { list, decide },
}));

import { useBronzeReviewPresenter } from "./useBronzeReviewPresenter";

const review = {
  id: "review-1",
  userId: "user-1",
  attemptId: "attempt-1",
  reasonCodes: ["PROFILE_FACE_REVIEW"],
  createdAt: "2026-10-02T00:00:00.000Z",
  providerJobId: "didit-job-1",
  checks: {
    governmentId: true,
    liveness: true,
    idFace: true,
    profileFace: false,
    dateOfBirth: true,
    gender: true,
    country: true,
  },
  profilePhotoUrl: "https://example.com/avatar.jpg",
};

describe("useBronzeReviewPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    list.mockReset().mockResolvedValue([review]);
    decide.mockReset().mockResolvedValue({ status: "verified" });
  });

  it("loads review items and blocks incomplete approval evidence", async () => {
    const { result } = renderHook(() => useBronzeReviewPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view.items).toHaveLength(1);

    act(() => result.current.view.items[0].onApprove());
    await waitFor(() => expect(result.current.error).toContain("evidence reference"));
    expect(decide).not.toHaveBeenCalled();
  });
});
