// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listenForInboxChanges,
  mergeNotifications,
  notificationsApi,
} from "./notifications.service";
import type { NotificationPM } from "@/domain/notification";
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post } }));
const item: NotificationPM = {
  id: "n1",
  type: "follow",
  actor: { name: "Ada", username: "ada", avatarUrl: null },
  url: "/u/ada",
  count: 1,
  createdAt: "2026-10-03T10:00:00Z",
  readAt: null,
};
beforeEach(() => {
  get.mockReset();
  post.mockReset();
  localStorage.clear();
});
describe("notificationsApi", () => {
  it("encodes pagination and unread filters", async () => {
    await notificationsApi.list();
    expect(get).toHaveBeenLastCalledWith("/notifications");
    await notificationsApi.list({ unread: true, cursor: "a+b=" });
    expect(get).toHaveBeenLastCalledWith("/notifications?unread=true&cursor=a%2Bb%3D");
  });
  it("requests category-filtered pages", async () => {
    await notificationsApi.list({ cursor: "next", type: "comment" });
    expect(get).toHaveBeenLastCalledWith("/notifications?type=comment&cursor=next");
  });
  it("asks the server to search, sending no blank search", async () => {
    await notificationsApi.list({ q: "  ada & co " });
    expect(get).toHaveBeenLastCalledWith("/notifications?q=ada+%26+co");
    await notificationsApi.list({ q: "   " });
    expect(get).toHaveBeenLastCalledWith("/notifications");
  });
  it("broadcasts a read only after the server accepts it", async () => {
    const changed = vi.fn();
    const stop = listenForInboxChanges(changed);
    post.mockRejectedValueOnce(new Error("offline"));
    await expect(notificationsApi.read("n1")).rejects.toThrow("offline");
    expect(changed).not.toHaveBeenCalled();
    post.mockResolvedValueOnce({ ...item, readAt: item.createdAt });
    await notificationsApi.read("n1");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith("/notifications/n1/read", {});
    stop();
  });
  it("broadcasts reads from another tab and cleans up its listeners", () => {
    const changed = vi.fn();
    const stop = listenForInboxChanges(changed);
    window.dispatchEvent(new StorageEvent("storage", { key: "kinkord:notifications-updated" }));
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new StorageEvent("storage", { key: "kinkord:notifications-updated" }));
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("merges without duplicates and uses the fresh persisted read state", () => {
    const old = { ...item, id: "old", createdAt: "2026-10-02T10:00:00Z" };
    const read = { ...item, readAt: item.createdAt };
    expect(mergeNotifications([item, old], [read])).toEqual([read, old]);
  });
});
