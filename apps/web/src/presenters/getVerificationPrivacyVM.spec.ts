import { describe, expect, it } from "vitest";
import { getVerificationPrivacyVM } from "./getVerificationPrivacyVM";

describe("getVerificationPrivacyVM", () => {
  it("provides the public KYC privacy notice and provider disclosure", () => {
    const vm = getVerificationPrivacyVM();
    expect(vm.homeHref).toBe("/");
    expect(vm.contactHref).toBe("/contact");
    expect(vm.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["information", "decision", "retention", "rights"]),
    );
    expect(vm.sections.flatMap((section) => section.paragraphs).join(" ")).toContain(
      "sensitive biometric personal data",
    );
    expect(vm.diditNoticeHref).toMatch(/^https:\/\/didit\.me\//);
  });
});
