import { describe, expect, it } from "vitest";
import { getCurrentUserId } from "./current-user.decorator";

describe("CurrentUser", () => {
  it("reads the authenticated user id attached by AuthGuard", () => {
    const request = { user: { id: "user-1" } };
    expect(getCurrentUserId(request)).toBe("user-1");
  });
});
