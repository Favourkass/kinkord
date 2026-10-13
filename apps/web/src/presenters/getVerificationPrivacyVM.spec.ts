import { describe, expect, it } from "vitest";
import { getVerificationPrivacyVM } from "./getVerificationPrivacyVM";

const sectionText = (id: string) =>
  getVerificationPrivacyVM()
    .sections.find((section) => section.id === id)
    ?.paragraphs.join(" ") ?? "";

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
    expect(text).toContain("Authorized Kinkord reviewers");
    expect(text).toContain("retries it if Didit is temporarily unavailable");
    expect(text).toContain("Settings → Verification");
    // Only Didit and the NIN registry: no other provider, bank check or stage is described.
    expect(text).not.toMatch(/Smile|Mono|bank|BVN|NIMC|residence|GPS/);
    expect(vm.provider.href).toMatch(/^https:\/\/didit\.me\//);
  });

  it("checks only IDs issued in Nigeria against the government's records", () => {
    const info = sectionText("information");
    expect(info).toContain("If your ID was issued in Nigeria");
    expect(info).toMatch(
      /NIN\) register for a national ID, the passport register.+driver's licence register/,
    );
    expect(info).toContain("IDs issued in other countries aren't checked");
    expect(info).not.toMatch(/BVN|bank/i);
  });

  it("discloses Didit's face search over Kinkord's own verified members", () => {
    const info = sectionText("information");
    expect(info).toContain("compares your selfie's face with the faces of other members");
    expect(info).toContain("only covers Kinkord's own verified members");
  });

  it("says what outlives withdrawal and account deletion", () => {
    const retention = sectionText("retention");
    expect(retention).toContain("stay in Kinkord's moderation log for accountability");
    expect(retention).toMatch(/revokes a verification or bans an account.+one-way fingerprint/);
    expect(retention).toContain("never the name or ID number");
    // Withdrawal doesn't promise to delete a fingerprint that is kept.
    expect(sectionText("withdrawal")).toContain("unless an admin has revoked your verification");
  });

  it("gives every section a unique anchor", () => {
    const vm = getVerificationPrivacyVM();
    const ids = [...vm.sections.map((s) => s.id), vm.provider.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
