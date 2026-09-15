import { describe, expect, it, vi } from "vitest";
import { attemptsMessage, verificationErrorMessage, verificationApi } from "./verification.service";

const post = vi.fn();
vi.mock("./apiClient", async () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`HTTP ${status}`);
    }
  }
  return { ApiError, api: { post: (...a: unknown[]) => post(...a) } };
});

const { ApiError } = await import("./apiClient");

describe("verificationApi", () => {
  it("asks the API to text the number on the member's own profile", async () => {
    post.mockResolvedValueOnce({ otpId: "o1", sentTo: "+234******3266" });
    await verificationApi.sendCode("phone");
    // No destination is sent: the API reads it from the account.
    expect(post).toHaveBeenCalledWith("/profile/phone/send-code", {});
  });

  it("routes the email channel to its own endpoint", async () => {
    post.mockResolvedValueOnce({ otpId: "o1", sentTo: "t**a@kinkord.com" });
    await verificationApi.sendCode("email");
    expect(post).toHaveBeenCalledWith("/profile/email/send-code", {});
  });

  it("sends the challenge id with the code, per channel", async () => {
    post.mockResolvedValueOnce({ verified: true, attemptsLeft: null });
    await verificationApi.verify("phone", "o1", "123456");
    expect(post).toHaveBeenCalledWith("/profile/phone/verify", { otpId: "o1", code: "123456" });

    post.mockResolvedValueOnce({ verified: true, attemptsLeft: null });
    await verificationApi.verify("email", "o2", "654321");
    expect(post).toHaveBeenCalledWith("/profile/email/verify", { otpId: "o2", code: "654321" });
  });
});

describe("verificationErrorMessage", () => {
  it("passes the API's own wording through, so cooldown and lockout read differently", () => {
    const cooldown = new ApiError(429, {
      message: "Please wait a minute before asking for another code.",
    });
    const lockout = new ApiError(429, { message: "Too many wrong codes. Try again in 24 hours." });
    expect(verificationErrorMessage(cooldown, "fallback")).toMatch(/wait a minute/);
    expect(verificationErrorMessage(lockout, "fallback")).toMatch(/24 hours/);
  });

  it("keeps the offline message, which apiClient passes as a plain string", () => {
    const offline = new ApiError(0, "Network problem — check your connection and try again.");
    expect(verificationErrorMessage(offline, "fallback")).toMatch(/Network problem/);
  });

  it("falls back when the failure carries nothing readable", () => {
    expect(verificationErrorMessage(new ApiError(500, null), "Could not send the code.")).toBe(
      "Could not send the code.",
    );
    expect(verificationErrorMessage({}, "Could not send the code.")).toBe(
      "Could not send the code.",
    );
    // Never "HTTP 500".
    expect(verificationErrorMessage(new ApiError(500, {}), "Could not send the code.")).not.toMatch(
      /HTTP/,
    );
  });
});

describe("attemptsMessage", () => {
  it("warns differently on the last attempt", () => {
    expect(attemptsMessage(2)).toMatch(/2 tries left/);
    expect(attemptsMessage(1)).toMatch(/One more try/);
  });

  it("says nothing when there is no attempt count to report", () => {
    expect(attemptsMessage(null)).toBeNull();
    expect(attemptsMessage(0)).toBeNull();
  });
});
