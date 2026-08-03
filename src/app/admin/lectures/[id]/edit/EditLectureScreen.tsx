"use client";

import type { Lecture } from "@/domain/lecture";
import { useLectureFormPresenter } from "@/presenters/useLectureFormPresenter";
import LectureFormView from "@/components/admin/LectureFormView";

export default function EditLectureScreen({ initial }: { initial: Lecture }) {
  const presenter = useLectureFormPresenter({ mode: "edit", initial });
  return <LectureFormView {...presenter} />;
}
