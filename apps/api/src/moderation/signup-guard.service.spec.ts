import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import type { EmailService } from "../email/email.service";
import type { SignupRule } from "./signup-rules";
import { SignupGuardService } from "./signup-guard.service";

const RULES: SignupRule[] = [
  { kind: "email", value: "ctolulope05@gmail.com", action: "block" },
  { kind: "name", value: "durowara", action: "flag" },
];

function make(opts: { rules?: SignupRule[]; sendFails?: boolean } = {}) {
  const from = vi.fn().mockResolvedValue(opts.rules ?? RULES);
  const db = { select: vi.fn(() => ({ from })) } as unknown as Db;
  const send = opts.sendFails
    ? vi.fn().mockRejectedValue(new Error("resend down"))
    : vi.fn().mockResolvedValue(undefined);
  const email = { send } as unknown as EmailService;
  return { guard: new SignupGuardService(db, email), send };
}

describe("SignupGuardService.review", () => {
  beforeEach(() => {
    process.env.MODERATION_EMAIL = "mod@kinkord.test";
  });
  afterEach(() => {
    delete process.env.MODERATION_EMAIL;
  });

  it("allows a clean sign-up without alerting anyone", async () => {
    const { guard, send } = make();
    const verdict = await guard.review({ email: "new@member.com", name: "New Member" }, "sign-up");
    expect(verdict.action).toBe("allow");
    expect(send).not.toHaveBeenCalled();
  });

  it("returns block for a removed email and tells the moderator he tried again", async () => {
    const { guard, send } = make();
    const verdict = await guard.review({ email: "c.tolulope05+2@gmail.com" }, "sign-up");
    expect(verdict.action).toBe("block");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "mod@kinkord.test",
      subject: "Kinkord moderation: a blocked member tried again",
    });
  });

  it("returns flag for a near-miss and asks for a review", async () => {
    const { guard, send } = make();
    const verdict = await guard.review({ email: "tolu.durowara@yahoo.com" }, "sign-up");
    expect(verdict.action).toBe("flag");
    expect(send.mock.calls[0][0].subject).toBe("Kinkord moderation: sign-up flagged for review");
    expect(send.mock.calls[0][0].text).toContain("name:durowara (flag)");
  });

  it("escapes what the member typed before putting it in the alert's HTML", async () => {
    const { guard, send } = make();
    await guard.review({ name: "<img src=x onerror=alert(1)> Durowara" }, "sign-up");
    const html: string = send.mock.calls[0][0].html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("still logs but sends nothing when no moderator address is configured", async () => {
    delete process.env.MODERATION_EMAIL;
    const { guard, send } = make();
    expect((await guard.review({ name: "Durowara" }, "sign-up")).action).toBe("flag");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not let a failed alert change the verdict", async () => {
    const { guard } = make({ sendFails: true });
    await expect(
      guard.review({ email: "ctolulope05@gmail.com" }, "sign-up"),
    ).resolves.toMatchObject({
      action: "block",
    });
  });
});
