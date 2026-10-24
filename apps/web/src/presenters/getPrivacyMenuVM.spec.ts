import { describe, it, expect } from "vitest";
import { getPrivacyMenuVM } from "./getPrivacyMenuVM";
import { Routes } from "@/constants/Routes";
describe("Privacy menu", () => {
  it("links all six requested categories, starting with profile visibility", () => {
    const menu = getPrivacyMenuVM();
    expect(menu.categories.map((item) => item.label)).toEqual([
      "Profile & Personal Information Visibility",
      "Messaging, Friend Requests & Following",
      "Activity Status",
      "Read Receipts",
      "Tagging & Mentions",
      "Content Sharing & Reposting",
    ]);
    expect(menu.categories[0].href).toBe(Routes.settingsPrivacyProfile);
    expect(new Set(menu.categories.map((item) => item.href)).size).toBe(6);
  });
});
