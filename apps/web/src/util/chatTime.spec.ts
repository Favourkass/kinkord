import { describe, expect, it } from "vitest";
import { bubbleTime, conversationTime, presenceLabel, chatDay } from "./chatTime";

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

// Times are built in the runner's own zone: worker threads can't switch zones mid-run.
describe("chat day headers", () => {
  it("labels today, yesterday across a year boundary, and older full dates", () => {
    const now = new Date(2026, 0, 1, 10);
    expect(chatDay(new Date(2026, 0, 1, 0, 1).toISOString(), now).label).toBe("Today");
    expect(chatDay(new Date(2025, 11, 31, 23, 59).toISOString(), now).label).toBe("Yesterday");
    const older = chatDay(new Date(2025, 11, 29, 12).toISOString(), now);
    expect(older.key).toBe("2025-12-29");
    expect(older.label).toBe(older.fullLabel);
    expect(older.label).toContain("2025");
  });
  it("groups by the viewer's local calendar day around midnight, not the UTC date", () => {
    const now = new Date(2026, 9, 24, 10);
    expect(chatDay(new Date(2026, 9, 24, 0, 30).toISOString(), now)).toMatchObject({
      key: "2026-10-24",
      label: "Today",
    });
    expect(chatDay(new Date(2026, 9, 23, 23, 30).toISOString(), now)).toMatchObject({
      key: "2026-10-23",
      label: "Yesterday",
    });
  });
  // Counts calendar days, not 24-hour spans, so a zone with daylight saving (run with
  // TZ=America/New_York) still finds yesterday on the mornings the clocks change.
  it("recognizes yesterday after daylight-saving clocks change", () => {
    expect(chatDay(new Date(2026, 2, 8, 0, 15).toISOString(), new Date(2026, 2, 9, 10)).label).toBe(
      "Yesterday",
    );
    expect(
      chatDay(new Date(2026, 10, 1, 0, 15).toISOString(), new Date(2026, 10, 2, 10)).label,
    ).toBe("Yesterday");
  });
});
