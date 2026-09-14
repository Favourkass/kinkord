import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, type OtpChannel } from "@/services/otp.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      channel?: OtpChannel;
      otp_id?: string;
      code?: string;
    };
    if (
      !["email", "sms"].includes(body.channel ?? "") ||
      !body.otp_id?.trim() ||
      !body.code?.trim()
    ) {
      return NextResponse.json({ error: "channel, otp_id, and code are required" }, { status: 400 });
    }

    const valid = await verifyOtp(body.channel!, body.otp_id, body.code);
    return NextResponse.json({ valid }, { status: valid ? 200 : 422 });
  } catch {
    return NextResponse.json({ error: "Could not verify code" }, { status: 502 });
  }
}