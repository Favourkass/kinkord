import { describe, expect, it } from "vitest";
import {
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
    });
  });

  it("counts a chat's messages since it was last read", () => {
    expect(toNotificationVM(item).action).toBe("sent you a message.");
    expect(toNotificationVM({ ...item, count: 3 }).body).toBe("Ada sent you 3 messages.");
  });

  it("shows Kinkord's own notices with the brand mark, not a member", () => {
    const vm = toNotificationVM({ ...item, type: "report", actor: null });
    expect(vm).toMatchObject({ official: true, actorName: null, avatarUrl: null });
    expect(vm.body).toBe("New report to review.");
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
