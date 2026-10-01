import { describe, expect, it } from "vitest";
import { EMPTY_REPORT, REPORT_DETAILS_MAX, REPORT_REASONS, toReportInput } from "./safety";

describe("toReportInput", () => {
  it("needs a reason before anything is sent", () => {
    expect(toReportInput(EMPTY_REPORT, "u2", "c1")).toBeNull();
  });

  it("sends the reason, the thread, trimmed details and whether to block too", () => {
    expect(
      toReportInput({ reason: "harassment", details: "  won't stop  ", block: true }, "u2", "c1"),
    ).toEqual({
      userId: "u2",
      conversationId: "c1",
      reason: "harassment",
      details: "won't stop",
      block: true,
    });
  });

  it("leaves out empty details and a missing thread, and stops at the length limit", () => {
    expect(toReportInput({ reason: "spam", details: "   ", block: false }, "u2")).toEqual({
      userId: "u2",
      reason: "spam",
      block: false,
    });
    const long = toReportInput(
      { reason: "other", details: "x".repeat(REPORT_DETAILS_MAX + 9), block: false },
      "u2",
    );
    expect(long?.details).toHaveLength(REPORT_DETAILS_MAX);
  });

  it("blocks in the same step unless the member says otherwise, and lists the worst first", () => {
    expect(EMPTY_REPORT.block).toBe(true);
    expect(REPORT_REASONS[0]).toBe("underage");
  });
});
