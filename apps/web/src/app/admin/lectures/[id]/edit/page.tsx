import { notFound } from "next/navigation";
import * as lectureService from "@/services/lecture.service";
import EditLectureScreen from "./EditLectureScreen";

export const metadata = { title: "Edit Lecture — Kinkord Admin" };

export default async function EditLecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lecture = await lectureService.getLectureById(id);
  if (!lecture) notFound();

  return <EditLectureScreen initial={lecture} />;
}
