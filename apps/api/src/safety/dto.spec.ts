import { describe, expect, it } from "vitest";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  blockSchema,
  reportQuerySchema,
  reportSchema,
  resolveReportSchema,
} from "./dto";

describe("reportSchema", () => {
  it("takes a reason, optional details and the chat it came from; blocking is opt-in", () => {
    expect(
      reportSchema.parse({
        userId: "u2",
        conversationId: "11111111-1111-4111-8111-111111111111",
        reason: "unwanted_sexual",
        details: "  sent me photos I didn't ask for  ",
      }),
    ).toEqual({
      userId: "u2",
      conversationId: "11111111-1111-4111-8111-111111111111",
      reason: "unwanted_sexual",
      details: "sent me photos I didn't ask for",
      block: false,
    });
  });

  it("refuses a reason it doesn't know, over-long details or a malformed thread id", () => {
    expect(reportSchema.safeParse({ userId: "u2", reason: "rude" }).success).toBe(false);
    expect(
      reportSchema.safeParse({
        userId: "u2",
        reason: "spam",
        details: "x".repeat(REPORT_DETAILS_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ userId: "u2", reason: "spam", conversationId: "c1" }).success,
    ).toBe(false);
  });

  it("lists the most serious reasons first", () => {
    expect(REPORT_REASONS.slice(0, 2)).toEqual(["underage", "illegal"]);
  });
});

describe("the other safety schemas", () => {
  it("need a member to block", () => {
    expect(blockSchema.safeParse({ userId: " " }).success).toBe(false);
    expect(blockSchema.parse({ userId: "u2" })).toEqual({ userId: "u2" });
  });

  it("read open reports by default, and close one as resolved or dismissed only", () => {
    expect(reportQuerySchema.parse({})).toEqual({ status: "open" });
    expect(resolveReportSchema.safeParse({ status: "open" }).success).toBe(false);
    expect(resolveReportSchema.parse({ status: "dismissed" })).toEqual({ status: "dismissed" });
  });
});
