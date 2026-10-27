import { describe, expect, it } from "vitest";
import {
  BUNDLE_WINDOW_MINUTES,
  DAILY_BUNDLED_CAP,
  decidePush,
  digestBody,
  groupOf,
  isQuietHours,
  localHour,
  timeZoneOf,
  type PushContext,
} from "./push-policy";

/** 14:00 in Lagos (13:00 UTC): daytime, outside quiet hours. */
const noonish = new Date("2026-10-26T13:00:00Z");
/** 01:00 in Lagos (00:00 UTC): quiet hours. */
const night = new Date("2026-10-27T00:00:00Z");
const ctx = (over: Partial<PushContext> = {}): PushContext => ({
  type: "like",
  now: noonish,
  timeZone: "Africa/Lagos",
  off: new Set(),
  lastSentOfType: null,
  bundledSentToday: 0,
  ...over,
});
const minutesBefore = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60_000);

describe("timeZoneOf", () => {
  it("knows each launch country, and the US by state", () => {
    expect(timeZoneOf("NG", "Lagos")).toBe("Africa/Lagos");
    expect(timeZoneOf("GH", "Greater Accra")).toBe("Africa/Accra");
    expect(timeZoneOf("KE", "Nairobi")).toBe("Africa/Nairobi");
    expect(timeZoneOf("US", "California")).toBe("America/Los_Angeles");
    expect(timeZoneOf("US", "Texas")).toBe("America/Chicago");
    expect(timeZoneOf("US", "Arizona")).toBe("America/Phoenix");
    expect(timeZoneOf("US", "District of Columbia")).toBe("America/New_York");
  });

  it("falls back to Eastern time for an unknown state, and to Lagos without a country", () => {
    expect(timeZoneOf("US", null)).toBe("America/New_York");
    expect(timeZoneOf(null, null)).toBe("Africa/Lagos");
  });
});

describe("quiet hours", () => {
  it("run from 11pm to 7am in the member's own time", () => {
    expect(localHour(new Date("2026-10-26T21:59:00Z"), "Africa/Lagos")).toBe(22);
    expect(isQuietHours(new Date("2026-10-26T21:59:00Z"), "Africa/Lagos")).toBe(false);
    expect(isQuietHours(new Date("2026-10-26T22:00:00Z"), "Africa/Lagos")).toBe(true);
    expect(isQuietHours(new Date("2026-10-27T05:59:00Z"), "Africa/Lagos")).toBe(true);
    expect(isQuietHours(new Date("2026-10-27T06:00:00Z"), "Africa/Lagos")).toBe(false);
  });

  it("follow the member's zone, not the server's", () => {
    // 07:00 UTC is 10am in Nairobi but midnight in Los Angeles.
    const at = new Date("2026-10-26T07:00:00Z");
    expect(isQuietHours(at, "Africa/Nairobi")).toBe(false);
    expect(isQuietHours(at, "America/Los_Angeles")).toBe(true);
  });
});

describe("decidePush", () => {
  it("sends messages at once, even at night", () => {
    expect(decidePush(ctx({ type: "message", now: night }))).toBe("send");
  });

  it("sends comments, mentions, tags and requests at once by day, and holds them at night", () => {
    for (const type of [
      "comment",
      "mention",
      "tag",
      "friend_request",
      "relationship_request",
    ] as const) {
      expect(decidePush(ctx({ type }))).toBe("send");
      expect(decidePush(ctx({ type, now: night }))).toBe("hold");
    }
  });

  it("sends the first like at once, then bundles for two hours", () => {
    expect(decidePush(ctx())).toBe("send");
    const recent = minutesBefore(noonish, BUNDLE_WINDOW_MINUTES - 1);
    expect(decidePush(ctx({ lastSentOfType: recent }))).toBe("hold");
    const due = minutesBefore(noonish, BUNDLE_WINDOW_MINUTES);
    expect(decidePush(ctx({ lastSentOfType: due }))).toBe("send");
  });

  it("spaces each bundled type on its own", () => {
    // A like an hour ago doesn't hold a follow: the caller passes the follow's own last send.
    expect(decidePush(ctx({ type: "follow", lastSentOfType: null }))).toBe("send");
  });

  it("stops bundled pushes for the day at the cap, but not instant ones", () => {
    expect(decidePush(ctx({ bundledSentToday: DAILY_BUNDLED_CAP - 1 }))).toBe("send");
    expect(decidePush(ctx({ bundledSentToday: DAILY_BUNDLED_CAP }))).toBe("hold");
    expect(decidePush(ctx({ type: "comment", bundledSentToday: DAILY_BUNDLED_CAP }))).toBe("send");
  });

  it("keeps a kind the member turned off out of their devices", () => {
    expect(decidePush(ctx({ off: new Set(["likes"]) }))).toBe("drop");
    expect(decidePush(ctx({ type: "repost", off: new Set(["likes"]) }))).toBe("drop");
    expect(decidePush(ctx({ type: "message", off: new Set(["messages"]) }))).toBe("drop");
    expect(decidePush(ctx({ type: "follow", off: new Set(["likes"]) }))).toBe("send");
  });

  it("always sends moderators' alerts and the push test at once, night or not", () => {
    for (const type of ["report", "payment", "verification_underage", "test"] as const) {
      expect(decidePush(ctx({ type, now: night }))).toBe("send");
    }
  });

  it("holds account notices through the night, and has no switch for them", () => {
    expect(groupOf("payment_verified")).toBeNull();
    expect(decidePush(ctx({ type: "payment_verified" }))).toBe("send");
    expect(decidePush(ctx({ type: "payment_verified", now: night }))).toBe("hold");
  });
});

describe("digestBody", () => {
  it("says who did it, and how many others, never what", () => {
    expect(digestBody("like", ["Ada"], 1, 1)).toBe("Ada liked your post");
    expect(digestBody("like", ["Ada", "Tega"], 2, 1)).toBe("Ada and 1 other liked your post");
    expect(digestBody("like", ["Ada", "Tega", "Kemi"], 5, 3)).toBe(
      "Ada and 2 others liked your posts",
    );
    expect(digestBody("like", ["Ada"], 3, 3)).toBe("Ada liked your posts");
    expect(digestBody("follow", ["Ada", "Tega", "Kemi", "Obi"], 4, 1)).toBe(
      "Ada and 3 others followed you",
    );
    expect(digestBody("kink_ring", ["Ada"], 1, 1)).toBe("Ada gave you a Kink Ring");
    expect(digestBody("kink_ring", ["Ada", "Tega"], 2, 2)).toBe(
      "Ada and 1 other gave you Kink Rings",
    );
  });

  it("pushes a Kink Ring at once, with no switch to turn it off, but not at night", () => {
    expect(groupOf("kink_ring")).toBeNull();
    expect(decidePush(ctx({ type: "kink_ring" }))).toBe("send");
    expect(decidePush(ctx({ type: "kink_ring", now: night }))).toBe("hold");
  });

  it("agrees the verb with more than one person", () => {
    expect(digestBody("relationship_request", ["Ada"], 1, 1)).toBe(
      "Ada wants to link a relationship with you",
    );
    expect(digestBody("relationship_request", ["Ada", "Tega"], 2, 2)).toBe(
      "Ada and 1 other want to link a relationship with you",
    );
  });

  it("repeats an account notice as it is", () => {
    expect(digestBody("payment_verified", [], 1, 1)).toBe("Your Silver Premium is active");
  });
});
