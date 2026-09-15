import { describe, expect, it } from "vitest";
import { resetPasswordEmail, verificationCodeEmail, verificationEmail } from "./templates";

/** What Gmail leaves behind: it drops <html>/<head>/<body> and keeps the rest. */
const asGmailWouldRenderIt = (html: string) =>
  html.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/g, "");

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

  it("keeps the black ground even when a client strips the body tag", () => {
    // Declared only on <body>, the brand would vanish in Gmail and gold text
    // would land on a white card.
    for (const html of [
      verificationCodeEmail("428391", 10).html,
      verificationEmail("https://x.test").html,
    ]) {
      expect(asGmailWouldRenderIt(html)).toMatch(/bgcolor="#0a0a0a"/);
    }
  });
});

describe("verificationCodeEmail", () => {
  const t = verificationCodeEmail("428391", 10);

  it("leads the subject with the code, so phones can offer it as autofill", () => {
    expect(t.subject.startsWith("428391")).toBe(true);
  });

  it("shows the code in both html and plain text", () => {
    expect(t.html).toContain("428391");
    expect(t.text).toContain("428391");
  });

  it("says how long it lasts, in both parts", () => {
    expect(t.html).toMatch(/expires in 10 minutes/);
    expect(t.text).toMatch(/expires in 10 minutes/);
  });

  it("carries the anti-phishing line", () => {
    expect(t.html).toMatch(/never ask you for this code/i);
    expect(t.text).toMatch(/never ask you for this code/i);
  });

  it("offers nothing to click — a code email with a link is a phishing lesson", () => {
    expect(t.html).not.toMatch(/<a\s/i);
  });

  it("gives the inbox its own preview line instead of scraping the body", () => {
    expect(t.html).toMatch(/Your code is 428391\. It expires in 10 minutes\./);
  });
});
