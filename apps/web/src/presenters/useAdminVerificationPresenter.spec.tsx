// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { Routes } from "@/constants/Routes";
import { clockTime, type AdminVerificationReviewPM } from "@/domain/moderation";
import { ApiError } from "@/services/apiClient";
import { useAdminVerificationPresenter } from "./useAdminVerificationPresenter";

const access = vi.fn();
const stepUpVerification = vi.fn();
const verificationReviews = vi.fn();
const decideVerification = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: {
    access: () => access(),
    stepUpVerification: (...a: unknown[]) => stepUpVerification(...a),
    verificationReviews: () => verificationReviews(),
    decideVerification: (...a: unknown[]) => decideVerification(...a),
  },
}));

const review = (
  id: string,
  over: Partial<AdminVerificationReviewPM> = {},
): AdminVerificationReviewPM => ({
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
  own: false,
  protected: false,
  duplicateOf: null,
  ...over,
});

/** The API's step-up answer: confirmed for `ms` from now. */
const confirmedFor = (ms: number) => async () => ({
  verifiedUntil: new Date(Date.now() + ms).toISOString(),
});

const stepUpRequired = () =>
  new ApiError(403, {
    message: "Confirm a current two-factor code for this admin session.",
    code: "STEP_UP_REQUIRED",
  });

async function confirmCode(result: { current: ReturnType<typeof useAdminVerificationPresenter> }) {
  act(() => result.current.stepUp?.setCode("123456"));
  await act(async () => result.current.stepUp?.submit());
}

async function loaded() {
  const hook = renderHook(() => useAdminVerificationPresenter());
  await waitFor(() => expect(hook.result.current.checking).toBe(false));
  await confirmCode(hook.result);
  await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));
  return hook;
}

describe("useAdminVerificationPresenter", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ isAdmin: true });
    stepUpVerification.mockReset().mockImplementation(confirmedFor(10 * 60_000));
    verificationReviews.mockReset().mockResolvedValue([review("v1"), review("v2")]);
    decideVerification.mockReset().mockResolvedValue({ status: "verified" });
  });
  afterEach(cleanup);

  it("loads the queue for an admin, linking each review to the member", async () => {
    const { result } = await loaded();
    expect(stepUpVerification).toHaveBeenCalledWith("123456");
    expect(result.current.stepUp).toBeNull();
    expect(result.current.confirmedUntil).toMatch(/^Confirmed until \d{2}:\d{2}$/);
    expect(result.current.rows[0]).toMatchObject({
      name: "Ada",
      memberHref: "/moderation/members/u2",
      canApprove: true,
      locked: null,
    });
  });

  it("asks for nothing when the member isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.stepUp).toBeNull();
    expect(stepUpVerification).not.toHaveBeenCalled();
    expect(verificationReviews).not.toHaveBeenCalled();
  });

  it("does not read sensitive reviews until this session passes 2FA", async () => {
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(verificationReviews).not.toHaveBeenCalled();
    expect(result.current.stepUp?.canSubmit).toBe(false);
    expect(result.current.stepUp?.security).toEqual({
      label: "Turn on two-factor in Security settings",
      href: Routes.settingsSecurity,
    });

    act(() => result.current.stepUp?.setCode("12ab3456"));
    expect(result.current.stepUp?.code).toBe("123456");
    expect(result.current.stepUp?.canSubmit).toBe(true);
    await act(async () => result.current.stepUp?.submit());
    await waitFor(() => expect(verificationReviews).toHaveBeenCalledOnce());
  });

  it("keeps every digit of a pasted code with a space in it", async () => {
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    act(() => result.current.stepUp?.setCode("123 456"));
    expect(result.current.stepUp?.code).toBe("123456");
    act(() => result.current.stepUp?.setCode("1234567"));
    expect(result.current.stepUp?.code).toBe("123456");
  });

  it("shows the API's message for a wrong code, with the box cleared for the next one", async () => {
    stepUpVerification.mockRejectedValue(
      new ApiError(403, { message: "That code isn't right.", code: "INVALID_CODE" }),
    );
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    await confirmCode(result);
    expect(result.current.stepUp?.error).toBe("That code isn't right.");
    expect(result.current.stepUp?.code).toBe("");
    expect(verificationReviews).not.toHaveBeenCalled();
  });

  it("says when a lock lifts after too many wrong codes", async () => {
    const retryAt = "2026-10-13T10:15:00Z";
    stepUpVerification.mockRejectedValue(
      new ApiError(429, {
        message: "Too many wrong codes. Try again in 15 minutes.",
        code: "STEP_UP_LOCKED",
        retryAt,
      }),
    );
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    await confirmCode(result);
    expect(result.current.stepUp?.error).toBe(
      `Too many wrong codes. Try again in 15 minutes. You can try again at ${clockTime(retryAt)}.`,
    );
  });

  it("tells an admin without two-factor, next to the link to turn it on", async () => {
    const message =
      "Turn on two-factor authentication (Settings, Security & 2FA) to review verifications.";
    stepUpVerification.mockRejectedValue(new ApiError(403, { message, code: "TWO_FACTOR_OFF" }));
    const { result } = renderHook(() => useAdminVerificationPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    await confirmCode(result);
    expect(result.current.stepUp?.error).toBe(message);
    expect(result.current.stepUp?.security.href).toBe(Routes.settingsSecurity);
  });

  it("asks for a new code when the confirmation runs out, then reads the queue again", async () => {
    stepUpVerification.mockImplementation(confirmedFor(300));
    const { result } = await loaded();
    expect(result.current.stepUp).toBeNull();

    await waitFor(() => expect(result.current.stepUp).not.toBeNull(), { timeout: 2000 });
    expect(result.current.stepUp?.error).toBe(
      "Your two-factor confirmation ran out. Enter a new code.",
    );
    expect(result.current.confirmedUntil).toBeNull();
    expect(verificationReviews).toHaveBeenCalledOnce();

    stepUpVerification.mockImplementation(confirmedFor(10 * 60_000));
    await confirmCode(result);
    await waitFor(() => expect(verificationReviews).toHaveBeenCalledTimes(2));
    expect(result.current.stepUp).toBeNull();
  });

  it("goes back to the code prompt when the API says the confirmation is missing", async () => {
    const { result } = await loaded();
    verificationReviews.mockRejectedValue(stepUpRequired());
    act(() => result.current.onRefresh());

    await waitFor(() => expect(result.current.stepUp).not.toBeNull());
    expect(result.current.stepUp?.error).toBe(
      "Your two-factor confirmation ran out. Enter a new code.",
    );
    expect(result.current.error).toBeNull();
  });

  it("keeps a decision and its reason behind the prompt until a new code is in", async () => {
    const { result } = await loaded();
    act(() => result.current.onReject("v2"));
    act(() => result.current.dialog?.reason?.set("Different person from the photo."));
    decideVerification.mockRejectedValueOnce(stepUpRequired());
    await act(async () => result.current.dialog?.confirm());

    expect(result.current.stepUp).not.toBeNull();
    expect(result.current.dialog).toBeNull();

    await confirmCode(result);
    await waitFor(() => expect(result.current.dialog).not.toBeNull());
    expect(result.current.dialog?.reason?.value).toBe("Different person from the photo.");
    expect(result.current.dialog?.error).toBeNull();
    await act(async () => result.current.dialog?.confirm());
    expect(decideVerification).toHaveBeenLastCalledWith("v2", {
      decision: "reject",
      evidenceReference: "didit:session-v2",
      reason: "Different person from the photo.",
    });
    expect(result.current.rows.map((r) => r.id)).toEqual(["v1"]);
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

  it("keeps the dialog open with the API's reason when a decision is refused, and reloads", async () => {
    decideVerification.mockRejectedValue(
      new ApiError(409, { message: "This review is already closed." }),
    );
    const { result } = await loaded();
    act(() => result.current.onReject("v2"));
    expect(result.current.dialog?.destructive).toBe(true);
    act(() => result.current.dialog?.reason?.set("Different person from the photo."));
    // Read again, the queue no longer has the review someone else closed.
    verificationReviews.mockResolvedValue([review("v1")]);
    await act(async () => result.current.dialog?.confirm());

    expect(result.current.dialog?.error).toBe("This review is already closed.");
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["v1"]));
    expect(verificationReviews).toHaveBeenCalledTimes(2);
    // Nothing left to decide, so it can't be sent again.
    expect(result.current.dialog?.canConfirm).toBe(false);
  });

  it("doesn't reload the queue for a refusal that isn't a conflict", async () => {
    decideVerification.mockRejectedValue(
      new ApiError(403, { message: "You can't decide your own verification." }),
    );
    const { result } = await loaded();
    act(() => result.current.onReject("v2"));
    act(() => result.current.dialog?.reason?.set("Different person from the photo."));
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("You can't decide your own verification.");
    expect(result.current.stepUp).toBeNull();
    expect(verificationReviews).toHaveBeenCalledOnce();
  });

  it("offers no decision on your own review or a protected one, and names a duplicate", async () => {
    verificationReviews.mockResolvedValue([
      review("v1", { own: true }),
      review("v2", { protected: true, duplicateOf: { userId: "u7", username: "twin" } }),
    ]);
    const { result } = await loaded();
    expect(result.current.rows.map((r) => r.locked)).toEqual([
      "You can't act on your own verification.",
      "Only a founder can decide an admin's verification.",
    ]);
    expect(result.current.rows[1].duplicate).toEqual({
      label: "Same ID as @twin",
      href: Routes.moderationMember("u7"),
    });
    act(() => result.current.onApprove("v1"));
    act(() => result.current.onReject("v2"));
    expect(result.current.dialog).toBeNull();
  });
});
