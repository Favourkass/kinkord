import { Inject, Injectable, Logger } from "@nestjs/common";
import { DRIZZLE, type Db } from "../db/db.module";
import { signupBlock } from "../db/schema";
import { EmailService } from "../email/email.service";
import { SUPER_ADMIN_EMAILS } from "./admins";
import { evaluateSignup, type SignupCandidate, type SignupVerdict } from "./signup-rules";

/**
 * Deliberately vague. Naming the identifier that tripped the rule tells a
 * removed member exactly which one to change.
 */
export const SIGNUP_REFUSED = "We couldn't create your account.";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

@Injectable()
export class SignupGuardService {
  private readonly log = new Logger(SignupGuardService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly email: EmailService,
  ) {}

  /**
   * Checks a would-be member against the block list. Every hit is logged and
   * emailed to the moderators, so neither a flagged sign-up nor a blocked
   * member trying again goes unnoticed. Refusing is the caller's job, because
   * each entry point words its own error.
   */
  async review(candidate: SignupCandidate, where: string): Promise<SignupVerdict> {
    const rules = await this.db
      .select({ kind: signupBlock.kind, value: signupBlock.value, action: signupBlock.action })
      .from(signupBlock);
    const verdict = evaluateSignup(candidate, rules);
    if (verdict.action === "allow") return verdict;

    // JSON-quoted so a name with a newline in it can't forge a second log line.
    const who = Object.entries(candidate)
      .filter(([, value]) => value)
      .map(([field, value]) => `${field}=${JSON.stringify(value)}`)
      .join(" ");
    const matched = verdict.matches.map((m) => `${m.kind}:${m.value} (${m.action})`).join(", ");
    this.log.warn(`[moderation] ${verdict.action} at ${where}: ${who} matched ${matched}`);
    await this.alert(verdict.action, where, who, matched);
    return verdict;
  }

  /**
   * MODERATION_EMAIL (comma-separated) overrides who hears about hits; without
   * it the super admins do, so alerts work without any deploy-time setting.
   */
  private recipients(): string[] {
    const configured = (process.env.MODERATION_EMAIL ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    return configured.length ? configured : SUPER_ADMIN_EMAILS;
  }

  private async alert(action: string, where: string, who: string, matched: string) {
    const heading =
      action === "block" ? "A blocked member tried again" : "Sign-up flagged for review";
    const site = (process.env.WEB_ORIGINS ?? "http://localhost:3000").split(",")[0].trim();
    const text = [
      heading,
      "",
      `Where: ${where}`,
      `Who: ${who}`,
      `Matched: ${matched}`,
      "",
      `Review in the admin panel: ${site}/moderation`,
    ].join("\n");
    await Promise.all(
      this.recipients().map(async (to) => {
        try {
          await this.email.send({
            to,
            subject: `Kinkord moderation: ${heading.toLowerCase()}`,
            text,
            html: `<pre>${escapeHtml(text)}</pre>`,
          });
        } catch (error) {
          // An alert that can't be sent must not decide whether someone can sign up.
          this.log.error(`[moderation] alert email to ${to} failed: ${String(error)}`);
        }
      }),
    );
  }
}
