import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/services/auth.service";
import { Routes } from "@/constants/Routes";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === Routes.adminLogin) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL(Routes.adminLogin, req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
