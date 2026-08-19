"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordEmail = exports.verificationEmail = void 0;
const shell = (title, body, ctaLabel, ctaUrl) => `<!doctype html>
<html>
  <body style="margin:0;background:#0a0a0a;color:#f5f5f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <p style="letter-spacing:.3em;color:#faab14;font-size:12px;font-weight:700;margin:0 0 24px;">KINKORD</p>
      <h1 style="font-size:22px;margin:0 0 16px;color:#faf7ed;">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#c2bfb2;">${body}</div>
      <a href="${ctaUrl}"
         style="display:inline-block;margin:28px 0;background:#ffd147;color:#030302;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;">
        ${ctaLabel}
      </a>
      <p style="font-size:12px;color:#6b6455;">If the button doesn't work, copy this link:<br/>
        <span style="word-break:break-all;color:#a49c88;">${ctaUrl}</span></p>
      <p style="font-size:11px;color:#6b6455;margin-top:32px;">You received this because of an action on kinkord.com. If it wasn't you, ignore this email.</p>
    </div>
  </body>
</html>`;
const verificationEmail = (url) => ({
    subject: "Verify your email — Kinkord",
    html: shell("Confirm your email address", "<p>Welcome to Kinkord. Confirm this email address to activate your account.</p>", "Verify email", url),
    text: `Welcome to Kinkord. Verify your email: ${url}`,
});
exports.verificationEmail = verificationEmail;
const resetPasswordEmail = (url) => ({
    subject: "Reset your password — Kinkord",
    html: shell("Reset your password", "<p>We received a request to reset your password. This link expires shortly. If it wasn't you, ignore this email — your password stays unchanged.</p>", "Reset password", url),
    text: `Reset your Kinkord password: ${url}`,
});
exports.resetPasswordEmail = resetPasswordEmail;
//# sourceMappingURL=templates.js.map