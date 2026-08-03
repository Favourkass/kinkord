import { NextRequest, NextResponse } from "next/server";
import { getLectures, createLecture, ensureSheetHeaders } from "@/lib/sheets";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

// GET /api/lectures          → published only (public)
// GET /api/lectures?all=true → all (admin)
export async function GET(req: NextRequest) {
  const isAdmin = req.nextUrl.searchParams.get("all") === "true";

  if (isAdmin) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lectures = await getLectures(!isAdmin);
  return NextResponse.json(lectures);
}

// POST /api/lectures → create (admin)
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSheetHeaders();
  const body = await req.json();
  const lecture = await createLecture(body);
  return NextResponse.json(lecture, { status: 201 });
}
