import { describe, expect, it } from "vitest";
import { classifyIdentifier } from "./identifier";

describe("classifyIdentifier", () => {
  it("classifies emails (leading @ is a handle, not an email)", () => {
    expect(classifyIdentifier("a@b.com")).toEqual({ kind: "email", value: "a@b.com" });
    expect(classifyIdentifier("@tegamaxwell").kind).toBe("username");
  });

  it("classifies usernames, stripping the @ and lowercasing", () => {
    expect(classifyIdentifier("@TegaMaxwell")).toEqual({ kind: "username", value: "tegamaxwell" });
    expect(classifyIdentifier("tega_99")).toEqual({ kind: "username", value: "tega_99" });
  });

  it("normalizes Nigerian local phone numbers to E.164", () => {
    expect(classifyIdentifier("0803 555 0142")).toEqual({ kind: "phone", value: "+2348035550142" });
    expect(classifyIdentifier("+234 803 555 0142")).toEqual({
      kind: "phone",
      value: "+2348035550142",
    });
  });

  it("keeps short digit-only strings as usernames (handles may be numeric)", () => {
    expect(classifyIdentifier("12345678").kind).toBe("username");
  });
});
