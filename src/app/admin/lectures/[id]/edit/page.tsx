import { getLectureById } from "@/lib/sheets";
import LectureForm from "@/components/admin/LectureForm";
import { notFound } from "next/navigation";

export const metadata = { title: "Edit Lecture — Kinkord Admin" };

export default async function EditLecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  if (!lecture) notFound();

  return <LectureForm mode="edit" initial={lecture} />;
}
