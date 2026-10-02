import { describe, expect, it } from "vitest";
import { bubbleTime, conversationTime, presenceLabel } from "./chatTime";

describe("chatTime", () => {
  const now = new Date(2026, 8, 28, 15, 0); // Mon 28 Sep 2026, local time

  it("shows the time for today and 'Yesterday' for the day before", () => {
    const today = new Date(2026, 8, 28, 9, 30).toISOString();
    expect(conversationTime(today, now)).toBe(bubbleTime(today));
    expect(conversationTime(new Date(2026, 8, 27, 23, 59).toISOString(), now)).toBe("Yesterday");
  });

  it("uses the weekday within a week and a date beyond it", () => {
    const thisWeek = new Date(2026, 8, 24, 12, 0).toISOString();
    expect(conversationTime(thisWeek, now)).toBe(
      new Date(thisWeek).toLocaleDateString([], { weekday: "short" }),
    );
    const older = new Date(2026, 7, 1, 12, 0).toISOString();
    expect(conversationTime(older, now)).toBe(
      new Date(older).toLocaleDateString([], { day: "2-digit", month: "short" }),
    );
  });

  it("only labels presence when the member is online", () => {
    expect(presenceLabel(true)).toBe("Online");
    expect(presenceLabel(false)).toBeNull();
  });
});
