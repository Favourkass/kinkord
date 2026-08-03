import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminCredentials,
  COOKIE_NAME,
  signToken,
} from "@/services/auth.service";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!checkAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({ username, role: "admin" });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return res;
}
