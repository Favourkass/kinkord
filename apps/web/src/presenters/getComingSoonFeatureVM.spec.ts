import { describe, expect, it } from "vitest";
import { Routes } from "@/constants/Routes";
import { COMING_SOON_FEATURES, getComingSoonFeatureVM } from "./getComingSoonFeatureVM";

describe("getComingSoonFeatureVM", () => {
  it("provides destination-specific copy", () => {
    expect(getComingSoonFeatureVM("marketplace")?.headline).toBe("MARKETPLACE");
    expect(getComingSoonFeatureVM("kinkopedia")?.headline).toBe("KINKOPEDIA");
  });

  it("knows nothing else, so unknown and built features 404", () => {
    expect(getComingSoonFeatureVM("unknown")).toBeNull();
    expect(getComingSoonFeatureVM("saved")).toBeNull();
    expect(getComingSoonFeatureVM("toString")).toBeNull();
  });

  it("has copy for every coming-soon route in the menu", () => {
    const menuRoutes = (Object.values(Routes) as unknown[]).filter(
      (r): r is string => typeof r === "string" && r.startsWith("/coming-soon/"),
    );
    expect(menuRoutes.map((r) => r.replace("/coming-soon/", "")).sort()).toEqual(
      [...COMING_SOON_FEATURES].sort(),
    );
  });
});
