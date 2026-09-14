import { NextRequest, NextResponse } from "next/server";
import { sendOtp, type OtpChannel } from "@/services/otp.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { channel?: OtpChannel; destination?: string };
    if (!["email", "sms"].includes(body.channel ?? "") || !body.destination?.trim()) {
      return NextResponse.json({ error: "channel and destination are required" }, { status: 400 });
    }

    const result = await sendOtp(body.channel!, body.destination);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not send verification code" }, { status: 502 });
  }
}