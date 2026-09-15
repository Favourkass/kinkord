import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/services/apiClient";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const response = await apiFetch("/api/otp/verify", { method: "POST", body: await request.text(), headers: { "content-type": "application/json" } });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Could not verify code" }, { status: 502 });
  }
}