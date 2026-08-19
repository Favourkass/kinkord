"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer_1 = require("nodemailer");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    logger = new common_1.Logger(EmailService_1.name);
    from = process.env.EMAIL_FROM ?? "Kinkord <no-reply@kinkord.com>";
    resend = process.env.RESEND_API_KEY
        ? new resend_1.Resend(process.env.RESEND_API_KEY)
        : null;
    smtp = process.env.RESEND_API_KEY
        ? null
        : (0, nodemailer_1.createTransport)({
            host: process.env.SMTP_HOST ?? "localhost",
            port: Number(process.env.SMTP_PORT ?? 1025),
            secure: false,
        });
    async send(input) {
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
        await this.smtp.sendMail({
            from: this.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
        });
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)()
], EmailService);
//# sourceMappingURL=email.service.js.map