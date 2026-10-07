import { describe, expect, it } from "vitest";
import {
  countsAfterRead,
  notificationDestination,
  toNotificationVM,
  type NotificationKind,
  type NotificationPM,
} from "./notification";

const item: NotificationPM = {
  id: "n1",
  type: "message",
  actor: { name: "Ada", username: "ada", avatarUrl: "/avatar.jpg" },
  url: "/messages/c1",
  count: 1,
  createdAt: "2026-10-03T10:00:00Z",
  readAt: null,
};

describe("notification presentation", () => {
  it.each<NotificationKind>([
    "message",
    "follow",
    "comment",
    "mention",
    "like",
    "repost",
    "report",
    "test",
    "payment",
    "payment_verified",
    "payment_rejected",
    "silver_check",
  ])("maps %s into a labelled notification", (type) => {
    const vm = toNotificationVM({ ...item, type }, new Date(item.createdAt));
    expect(vm.category).toBeTruthy();
    expect(vm.icon).toBeTruthy();
    expect(vm.action).toMatch(/\.$/);
  });

  it("writes the sentence from who did it as they are now, bolding the name apart", () => {
    expect(
      toNotificationVM({
        ...item,
        type: "like",
        actor: { name: "Ada Lovelace", username: "ada", avatarUrl: "/avatar.jpg" },
      }),
    ).toMatchObject({
      actorName: "Ada Lovelace",
      action: "liked your post.",
      body: "Ada Lovelace liked your post.",
      avatarUrl: "/avatar.jpg",
      official: false,
      actorSilver: false,
    });
  });

  it("puts the Silver check beside a Silver member's name", () => {
    const actor = { name: "Ada", username: "ada", avatarUrl: null, silver: true };
    expect(toNotificationVM({ ...item, type: "follow", actor }).actorSilver).toBe(true);
  });

  it("counts a chat's messages since it was last read", () => {
    expect(toNotificationVM(item).action).toBe("sent you a message.");
    expect(toNotificationVM({ ...item, count: 3 }).body).toBe("Ada sent you 3 messages.");
  });

  it("shows Kinkord's own notices with the brand mark, not a member", () => {
    const vm = toNotificationVM({ ...item, type: "report", actor: null });
    expect(vm).toMatchObject({ official: true, actorName: null, avatarUrl: null });
    expect(vm.body).toBe("New report to review.");
    expect(toNotificationVM({ ...item, type: "payment_verified", actor: null })).toMatchObject({
      official: true,
      category: "Silver Premium",
    });
    expect(toNotificationVM({ ...item, type: "silver_check", actor: null })).toMatchObject({
      official: true,
      category: "Silver badges",
      body: "A Silver member changed their name or photo. Review their badge.",
    });
  });

  it("still shows a kind this version doesn't know, rather than breaking the inbox", () => {
    const vm = toNotificationVM({ ...item, type: "gift" as NotificationKind });
    expect(vm).toMatchObject({ official: true, actorName: null, icon: "bell" });
    expect(vm.body).toBe("Something new for you.");
  });

  it("distinguishes read state and formats recent times", () => {
    expect(toNotificationVM(item, new Date("2026-10-03T10:05:00Z"))).toMatchObject({
      unread: true,
      time: "5m",
    });
    expect(
      toNotificationVM({ ...item, readAt: item.createdAt }, new Date(item.createdAt)),
    ).toMatchObject({ unread: false, time: "Just now" });
    expect(toNotificationVM(item, new Date("2026-10-03T12:00:00Z")).time).toBe("2h");
  });

  it.each([
    "javascript:alert(1)",
    "https://other.test",
    "//other.test",
    "/\\other.test",
    "/\n/other.test",
  ])("refuses unsafe navigation: %s", (url) => {
    expect(notificationDestination(url)).toBeNull();
  });

  it("accepts internal destinations", () =>
    expect(notificationDestination("/p/post-1")).toBe("/p/post-1"));
});

it("shows follows with the person badge", () => {
  expect(toNotificationVM({ ...item, type: "follow" }).icon).toBe("person-add");
});

describe("countsAfterRead", () => {
  const counts = { all: 5, comment: 2, mention: 1 };
  it("lowers All and the matching tab", () => {
    expect(countsAfterRead(counts, "comment")).toEqual({ all: 4, comment: 1, mention: 1 });
    expect(countsAfterRead(counts, "mention")).toEqual({ all: 4, comment: 2, mention: 0 });
    expect(countsAfterRead(counts, "follow")).toEqual({ all: 4, comment: 2, mention: 1 });
  });
  it("never goes below zero, and leaves messages out", () => {
    expect(countsAfterRead({ all: 0, comment: 0, mention: 0 }, "comment")).toEqual({
      all: 0,
      comment: 0,
      mention: 0,
    });
    expect(countsAfterRead(counts, "message")).toBe(counts);
  });
});
