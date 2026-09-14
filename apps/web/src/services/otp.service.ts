import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Robase } from "@robasedev/sdk";

export type OtpChannel = "email" | "sms";

interface EmailChallenge {
  channel: "email";
  destination: string;
  code: string;
  expiresAt: number;
}

interface OtpResult {
  id: string;
  channel: OtpChannel;
  expiresAt: number;
}

const OTP_TTL_SECONDS = 10 * 60;

function secretKey() {
  const secret = process.env.OTP_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("OTP_SECRET or AUTH_SECRET must be configured");
  return createHash("sha256").update(secret).digest();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function code() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function encryptEmailChallenge(challenge: EmailChallenge) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(challenge), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptEmailChallenge(id: string): EmailChallenge | null {
  try {
    const payload = Buffer.from(id, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8"),
    ) as EmailChallenge;
  } catch {
    return null;
  }
}

function robase() {
  const apiKey = process.env.ROBASE_API_KEY;
  if (!apiKey) throw new Error("ROBASE_API_KEY must be configured");
  return new Robase({ apiKey });
}

async function sendEmailCode(email: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY must be configured for email OTP");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Kinkord <no-reply@kinkord.com>",
      to: [email],
      subject: "Your Kinkord verification code",
      text: `Your Kinkord verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your Kinkord verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    }),
  });
  if (!response.ok) throw new Error("Email OTP delivery failed");
}

export async function sendOtp(channel: OtpChannel, destination: string): Promise<OtpResult> {
  const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;
  if (channel === "sms") {
    const sent = await robase().otp.send({ phone_number: destination });
    return { id: sent.id, channel, expiresAt };
  }

  const normalizedEmail = normalizeEmail(destination);
  const otp = code();
  await sendEmailCode(normalizedEmail, otp);
  return {
    id: encryptEmailChallenge({
      channel,
      destination: normalizedEmail,
      code: otp,
      expiresAt,
    }),
    channel,
    expiresAt,
  };
}

export async function verifyOtp(
  channel: OtpChannel,
  id: string,
  value: string,
): Promise<boolean> {
  if (channel === "sms") return (await robase().otp.verify({ otp_id: id, code: value })).valid;

  const challenge = decryptEmailChallenge(id);
  if (!challenge || challenge.expiresAt < Date.now() || !/^\d{6}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(challenge.code), Buffer.from(value));
}