import { describe, expect, it } from "vitest";
import { bronzeStatusText, type BronzeLaunchPM } from "./bronzeVerification";

describe("bronze verification domain", () => {
  it("maps every status to user-facing copy", () => {
    expect(bronzeStatusText("not_started")).toBe("Not started");
    expect(bronzeStatusText("pending")).toContain("In progress");
    expect(bronzeStatusText("failed")).toContain("try again");
    expect(bronzeStatusText("manual_review")).toBe("Manual review required");
    expect(bronzeStatusText("verified")).toBe("Identity stage complete");
  });

  it("keeps provider launches discriminated", () => {
    const launch: BronzeLaunchPM = {
      provider: "didit",
      attemptId: "attempt-1",
      url: "https://verification.example/session",
    };
    expect(launch.provider).toBe("didit");
  });
});
