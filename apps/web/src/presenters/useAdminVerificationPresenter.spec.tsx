// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminVerificationReviewPM } from "@/domain/moderation";
import { useAdminVerificationPresenter } from "./useAdminVerificationPresenter";

const access = vi.fn();
const verificationReviews = vi.fn();
const decideVerification = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: {
    access: () => access(),
    verificationReviews: () => verificationReviews(),
    decideVerification: (...a: unknown[]) => decideVerification(...a),
  },
}));

const review = (id: string, over: Partial<AdminVerificationReviewPM> = {}) => ({
  id,
  userId: "u2",
  username: "ada",
  displayName: "Ada",
  reasonCodes: ["PROFILE_PHOTO_MATCH_INCONCLUSIVE"],
  createdAt: "2026-10-03T10:00:00Z",
  providerSessionId: `session-${id}`,
  checks: {
    governmentId: true,
    liveness: true,
    idFace: true,
    profileFace: false,
    dateOfBirth: true,
    gender: true,
    country: true,
  },
  photoUrl: "https://media/a_md.jpg",
  originalPhotoUrl: "https://media/a.jpg",
  ...over,
});

async function loaded() {
  const hook = renderHook(() => useAdminVerificationPresenter());
  await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));
  return hook;
}

describe("useAdminVerificationPresenter", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ isAdmin: true });
    verificationReviews.mockReset().mockResolvedValue([review("v1"), review("v2")]);
    decideVerification.mockReset().mockResolvedValue({ status: "verified" });
  });
  afterEach(cleanup);

  it("loads the queue for an admin, linking each review to the member", async () => {
    const { result } = await loaded();
    expect(result.current.rows[0]).toMatchObject({
      name: "Ada",
      memberHref: "/moderation/members/u2",
      canApprove: true,
    });
  });

  it("asks for nothing when the member isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(verificationReviews).not.toHaveBeenCalled();
  });

  it("needs evidence and a reason before a decision, then removes the review", async () => {
    const { result } = await loaded();
    act(() => result.current.onApprove("v1"));
    expect(result.current.dialog?.input?.value).toBe("didit:session-v1");
    expect(result.current.dialog?.canConfirm).toBe(false);

    act(() => result.current.dialog?.reason?.set("Same person in the selfie and photo."));
    expect(result.current.dialog?.canConfirm).toBe(true);
    await act(async () => result.current.dialog?.confirm());

    expect(decideVerification).toHaveBeenCalledWith("v1", {
      decision: "approve",
      evidenceReference: "didit:session-v1",
      reason: "Same person in the selfie and photo.",
    });
    expect(result.current.dialog).toBeNull();
    expect(result.current.rows.map((r) => r.id)).toEqual(["v2"]);
    expect(result.current.notice).toMatch(/Approved/);
  });

  it("keeps the dialog open with the API's reason when a decision is refused", async () => {
    decideVerification.mockRejectedValue(new Error("This review is already closed."));
    const { result } = await loaded();
    act(() => result.current.onReject("v2"));
    expect(result.current.dialog?.destructive).toBe(true);
    act(() => result.current.dialog?.reason?.set("Different person from the photo."));
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("This review is already closed.");
    // The queue is read again so the closed review drops out.
    await waitFor(() => expect(verificationReviews).toHaveBeenCalledTimes(2));
  });
});
