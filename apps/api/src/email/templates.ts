/**
 * Brand frame every Kinkord email sits in: black ground, gold wordmark, cream
 * copy.
 *
 * Built on tables with `bgcolor`, not a styled `<body>`, because Gmail drops
 * the `<html>` and `<body>` tags and keeps only what is inside them — a
 * background declared on `<body>` disappears there, and cream-on-gold text
 * would land on a white card, which is close to unreadable.
 *
 * `preheader` is the grey line an inbox shows next to the subject. Without one
 * the client scrapes the first words of the body instead, which reads badly.
 */
const page = (title: string, preheader: string, body: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background:#0a0a0a;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
            <tr>
              <td style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
                <p style="letter-spacing:.3em;color:#faab14;font-size:12px;font-weight:700;margin:0 0 6px;">KINKORD</p>
                <p style="letter-spacing:.18em;color:#6b6455;font-size:10px;font-weight:600;margin:0 0 28px;">THE WORLD'S KINK COMMUNITY</p>
                <h1 style="font-size:22px;margin:0 0 16px;color:#faf7ed;">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:#c2bfb2;">${body}</div>
                <p style="font-size:11px;color:#6b6455;margin:32px 0 0;border-top:1px solid #1f1c16;padding-top:16px;">
                  You received this because of an action on kinkord.com. If it wasn't you, ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/** Gold pill button, used by the link-based emails. */
const button = (label: string, url: string) => `
  <a href="${url}"
     style="display:inline-block;margin:28px 0;background:#ffd147;color:#030302;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;">
    ${label}
  </a>
  <p style="font-size:12px;color:#6b6455;">If the button doesn't work, copy this link:<br/>
    <span style="word-break:break-all;color:#a49c88;">${url}</span></p>`;

export const verificationEmail = (url: string) => ({
  subject: "Verify your email — Kinkord",
  html: page(
    "Confirm your email address",
    "Confirm this address to activate your Kinkord account.",
    `<p style="margin:0;">Welcome to Kinkord. Confirm this email address to activate your account.</p>${button("Verify email", url)}`,
  ),
  text: `Welcome to Kinkord. Verify your email: ${url}`,
});

export const resetPasswordEmail = (url: string) => ({
  subject: "Reset your password — Kinkord",
  html: page(
    "Reset your password",
    "A link to set a new password. It expires shortly.",
    `<p style="margin:0;">We received a request to reset your password. This link expires shortly. If it wasn't you, ignore this email — your password stays unchanged.</p>${button("Reset password", url)}`,
  ),
  text: `Reset your Kinkord password: ${url}`,
});

/**
 * The code is the whole message, so it is set large, spaced and selectable —
 * these are read on a phone, and half of them are copied by tap-and-hold.
 * Gold on near-black, matching the code boxes in the app itself.
 */
export const verificationCodeEmail = (code: string, minutes: number) => ({
  // Leading with the code lets phones offer it as an autofill suggestion.
  subject: `${code} is your Kinkord verification code`,
  html: page(
    "Your verification code",
    `Your code is ${code}. It expires in ${minutes} minutes.`,
    `<p style="margin:0;">Enter this code in the app to confirm your email address.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
       <tr>
         <td bgcolor="#141310" align="center"
             style="background:#141310;border:1px solid #3a3323;border-radius:14px;padding:18px 28px;
                    color:#ffd147;font-size:34px;font-weight:700;letter-spacing:.32em;
                    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${code}</td>
       </tr>
     </table>
     <p style="margin:0 0 12px;">It expires in ${minutes} minutes and can only be used once.</p>
     <p style="margin:0;color:#a49c88;">Kinkord will never ask you for this code. If you didn't ask to verify, ignore this email.</p>`,
  ),
  text: `${code} is your Kinkord verification code. It expires in ${minutes} minutes. Kinkord will never ask you for this code.`,
});
