import { describe, expect, it } from "vitest";
import { getComingSoonFeatureVM } from "./getComingSoonFeatureVM";

describe("getComingSoonFeatureVM", () => {
  it("provides destination-specific copy", () => {
    expect(getComingSoonFeatureVM("marketplace").headline).toBe("MARKETPLACE");
    expect(getComingSoonFeatureVM("your-data").headline).toBe("YOUR DATA");
  });

  it("fails safely for an unknown destination", () => {
    expect(getComingSoonFeatureVM("unknown").headline).toBe("COMING SOON");
  });
});
