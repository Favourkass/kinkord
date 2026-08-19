import { Injectable, Logger } from "@nestjs/common";
import { createTransport, Transporter } from "nodemailer";
import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Email port. Resend in real environments (RESEND_API_KEY set);
 * falls back to SMTP (Mailpit on localhost:1025) for local dev.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from = process.env.EMAIL_FROM ?? "Kinkord <no-reply@kinkord.com>";
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
  private readonly smtp: Transporter | null = process.env.RESEND_API_KEY
    ? null
    : createTransport({
        host: process.env.SMTP_HOST ?? "localhost",
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: false,
      });

  async send(input: SendEmailInput): Promise<void> {
    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      if (error) {
        this.logger.error(`resend send failed: ${error.message}`);
        throw new Error(`Email delivery failed: ${error.message}`);
      }
      return;
    }
    await this.smtp!.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}
