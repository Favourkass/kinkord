import { NextRequest, NextResponse } from "next/server";
import { getLectureById, updateLecture, deleteLecture } from "@/lib/sheets";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

function adminGuard(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

// GET /api/lectures/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  if (!lecture) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lecture);
}

// PUT /api/lectures/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await adminGuard(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updated = await updateLecture(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/lectures/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await adminGuard(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteLecture(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
