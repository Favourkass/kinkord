import LectureForm from "@/components/admin/LectureForm";

export const metadata = { title: "New Lecture — Kinkord Admin" };

export default function NewLecturePage() {
  return <LectureForm mode="create" />;
}
