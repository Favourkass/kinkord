import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();
const smtpSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));
vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: smtpSend }),
}));

const message = { to: "a@b.c", subject: "s", html: "<p>h</p>", text: "t" };
const env = { ...process.env };

describe("EmailService", () => {
  beforeEach(() => {
    vi.resetModules();
    resendSend.mockReset().mockResolvedValue({ error: null });
    smtpSend.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("uses Resend when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Kinkord <no-reply@kinkord.com>";
    const { EmailService } = await import("./email.service");
    await new EmailService().send(message);
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Kinkord <no-reply@kinkord.com>", to: "a@b.c" }),
    );
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it("throws when Resend reports a delivery error", async () => {
    process.env.RESEND_API_KEY = "re_test";
    resendSend.mockResolvedValue({ error: { message: "bounced" } });
    const { EmailService } = await import("./email.service");
    await expect(new EmailService().send(message)).rejects.toThrow(/bounced/);
  });

  it("falls back to SMTP (Mailpit) without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;
    const { EmailService } = await import("./email.service");
    await new EmailService().send(message);
    expect(smtpSend).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.c" }));
    expect(resendSend).not.toHaveBeenCalled();
  });
});
