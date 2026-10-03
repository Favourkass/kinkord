import { describe, expect, it } from "vitest";
import {
  notificationDestination,
  searchNotifications,
  toNotificationVM,
  type NotificationKind,
  type NotificationPM,
} from "./notification";
const item: NotificationPM = {
  id: "n1",
  type: "message",
  title: "Kinkord",
  body: "New message from Ada",
  url: "/messages/c1",
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
    expect(vm.body).toBe(item.body);
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
  it("separates the bold actor from the action without losing names containing spaces", () => {
    expect(
      toNotificationVM({
        ...item,
        type: "like",
        body: "Ada Lovelace liked your post",
        actor: { name: "Ada Lovelace", avatarUrl: "/avatar.jpg" },
      }),
    ).toMatchObject({
      actorName: "Ada Lovelace",
      action: "liked your post.",
      avatarUrl: "/avatar.jpg",
    });
    expect(toNotificationVM({ ...item, actor: { name: "Ada", avatarUrl: null } }).action).toBe(
      "sent you a message.",
    );
  });
  it("searches actor and activity case-insensitively", () => {
    expect(searchNotifications([item], " ADA ")).toEqual([item]);
    expect(searchNotifications([item], "liked")).toEqual([]);
  });
  it("accepts internal destinations", () =>
    expect(notificationDestination("/p/post-1")).toBe("/p/post-1"));
});
