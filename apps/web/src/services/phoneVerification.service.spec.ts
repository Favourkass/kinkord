import { describe, expect, it, vi } from "vitest";
import {
  attemptsMessage,
  phoneErrorMessage,
  phoneVerificationApi,
} from "./phoneVerification.service";

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

describe("phoneVerificationApi", () => {
  it("asks the API to text the number on the member's own profile", async () => {
    post.mockResolvedValueOnce({ otpId: "o1", sentTo: "+234******3266" });
    await phoneVerificationApi.sendCode();
    // No destination is sent: the API reads it from the profile.
    expect(post).toHaveBeenCalledWith("/profile/phone/send-code", {});
  });

  it("sends the challenge id with the code", async () => {
    post.mockResolvedValueOnce({ verified: true, attemptsLeft: null });
    await phoneVerificationApi.verify("o1", "123456");
    expect(post).toHaveBeenCalledWith("/profile/phone/verify", { otpId: "o1", code: "123456" });
  });
});

describe("phoneErrorMessage", () => {
  it("passes the API's own wording through, so cooldown and lockout read differently", () => {
    const cooldown = new ApiError(429, {
      message: "Please wait a minute before asking for another code.",
    });
    const lockout = new ApiError(429, { message: "Too many wrong codes. Try again in 24 hours." });
    expect(phoneErrorMessage(cooldown, "fallback")).toMatch(/wait a minute/);
    expect(phoneErrorMessage(lockout, "fallback")).toMatch(/24 hours/);
  });

  it("keeps the offline message, which apiClient passes as a plain string", () => {
    const offline = new ApiError(0, "Network problem — check your connection and try again.");
    expect(phoneErrorMessage(offline, "fallback")).toMatch(/Network problem/);
  });

  it("falls back when the failure carries nothing readable", () => {
    expect(phoneErrorMessage(new ApiError(500, null), "Could not send the code.")).toBe(
      "Could not send the code.",
    );
    expect(phoneErrorMessage({}, "Could not send the code.")).toBe("Could not send the code.");
    // Never "HTTP 500".
    expect(phoneErrorMessage(new ApiError(500, {}), "Could not send the code.")).not.toMatch(
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
