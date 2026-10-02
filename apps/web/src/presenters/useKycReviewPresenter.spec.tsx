// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, list, decide } = vi.hoisted(() => ({
  replace: vi.fn(),
  list: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/kycReview.service", () => ({ kycReviewApi: { list, decide } }));

import { useKycReviewPresenter } from "./useKycReviewPresenter";

const review = {
  id: "review-1",
  caseUserId: "user-1",
  attemptId: "attempt-1",
  stage: "residence" as const,
  reasonCodes: ["PROOF_REVIEW"],
  createdAt: "2026-10-02T00:00:00.000Z",
  provider: "didit",
  providerReference: "provider-1",
  summary: { documentReceived: true },
};

describe("useKycReviewPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    list.mockReset().mockResolvedValue([review]);
    decide.mockReset().mockResolvedValue({ status: "passed" });
  });

  it("loads the protected queue and validates reviewer notes", async () => {
    const { result } = renderHook(() => useKycReviewPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view.items[0]).toMatchObject({ stage: "residence", busy: false });

    act(() => result.current.view.items[0].onReject());
    await waitFor(() => expect(result.current.error).toContain("evidence reference"));
    expect(decide).not.toHaveBeenCalled();
  });
});
