import { describe, expect, it } from "vitest";
import { getVerificationPrivacyVM } from "./getVerificationPrivacyVM";

describe("getVerificationPrivacyVM", () => {
  it("covers identity verification only, with the provider notice", () => {
    const vm = getVerificationPrivacyVM();
    expect(vm.homeHref).toBe("/");
    expect(vm.contactHref).toBe("/contact");
    expect(vm.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["information", "decision", "visibility", "withdrawal", "retention"]),
    );
    const text = vm.sections.flatMap((section) => section.paragraphs).join(" ");
    expect(text).toContain("sensitive biometric data");
    expect(text).toContain("Settings → Verification");
    // Only Didit: no other provider or stage is described.
    expect(text).not.toMatch(/Smile|Mono|bank-connection|residence|GPS/);
    expect(vm.provider.href).toMatch(/^https:\/\/didit\.me\//);
  });

  it("gives every section a unique anchor", () => {
    const vm = getVerificationPrivacyVM();
    const ids = [...vm.sections.map((s) => s.id), vm.provider.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
