import { describe, expect, it } from "vitest";
import { resetPasswordEmail, verificationEmail } from "./templates";

describe("email templates", () => {
  it("verification email carries the link in html and text", () => {
    const t = verificationEmail("https://api.kinkord.com/verify?token=abc");
    expect(t.subject).toMatch(/Verify/i);
    expect(t.html).toContain("https://api.kinkord.com/verify?token=abc");
    expect(t.text).toContain("https://api.kinkord.com/verify?token=abc");
  });

  it("reset email carries the link and never promises to change anything unprompted", () => {
    const t = resetPasswordEmail("https://kinkord.com/reset?token=xyz");
    expect(t.subject).toMatch(/Reset/i);
    expect(t.html).toContain("https://kinkord.com/reset?token=xyz");
    expect(t.html).toMatch(/ignore this email/i);
  });
});
