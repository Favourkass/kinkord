"use client";

import { useLectureFormPresenter } from "@/presenters/useLectureFormPresenter";
import LectureFormView from "@/components/admin/LectureFormView";

export default function NewLectureScreen() {
  const presenter = useLectureFormPresenter({ mode: "create" });
  return <LectureFormView {...presenter} />;
}
