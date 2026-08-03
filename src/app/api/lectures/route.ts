import { NextRequest, NextResponse } from "next/server";
import * as lectureService from "@/services/lecture.service";
import { verifyToken, COOKIE_NAME } from "@/services/auth.service";

export async function GET(req: NextRequest) {
  const isAdmin = req.nextUrl.searchParams.get("all") === "true";

  if (isAdmin) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lectures = isAdmin
    ? await lectureService.listAllLectures()
    : await lectureService.listPublishedLectures();

  return NextResponse.json(lectures);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const lecture = await lectureService.createLecture(body);
  return NextResponse.json(lecture, { status: 201 });
}
