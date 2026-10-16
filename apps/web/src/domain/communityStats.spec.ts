import { describe, expect, it } from "vitest";
import { communityStatsToVM } from "./communityStats";
describe("communityStatsToVM", () => {
  it("formats an actual count for display without rounding or inventing members", () => {
    expect(communityStatsToVM({ members: 12487 })).toEqual({ count: "12,487" });
    expect(communityStatsToVM({ members: 0 })).toEqual({ count: "0" });
  });
});
