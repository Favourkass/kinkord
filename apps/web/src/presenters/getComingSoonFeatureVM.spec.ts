import { describe, expect, it } from "vitest";
import { Routes } from "@/constants/Routes";
import { COMING_SOON_FEATURES, getComingSoonFeatureVM } from "./getComingSoonFeatureVM";

describe("getComingSoonFeatureVM", () => {
  it("has a screen for every unfinished account-menu entry", () => {
    const slugs = [
      Routes.kinkopediaInApp,
      Routes.marketplace,
      Routes.settingsData,
      Routes.settingsContent,
      Routes.settingsCommunitySafety,
    ].map((href) => href.replace("/coming-soon/", ""));
    expect([...COMING_SOON_FEATURES].sort()).toEqual([...slugs].sort());
    for (const slug of slugs) expect(getComingSoonFeatureVM(slug)?.headline).toBeTruthy();
  });

  it("is null for anything else, so the route 404s", () => {
    expect(getComingSoonFeatureVM("subscription")).toBeNull();
    expect(getComingSoonFeatureVM("constructor")).toBeNull();
  });
});
