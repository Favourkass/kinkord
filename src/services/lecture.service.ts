import type { Lecture, LectureInput, LectureVM } from "@/domain/lecture";
import { lectureToVM } from "@/domain/lecture";
import * as lectureRepository from "@/repositories/lecture.repository";

export function excerpt(body: string, max = 120): string {
  const first = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return first.length > max ? first.slice(0, max).trimEnd() + "…" : first;
}

export async function listPublishedLectures(): Promise<LectureVM[]> {
  const lectures = await lectureRepository.getLectures(true);
  return lectures.map(lectureToVM);
}

export async function listAllLectures(): Promise<Lecture[]> {
  return lectureRepository.getLectures(false);
}

export async function getLectureVmBySlug(slug: string): Promise<LectureVM | null> {
  const lecture = await lectureRepository.getLectureBySlug(slug);
  return lecture ? lectureToVM(lecture) : null;
}

export async function getLectureById(id: string): Promise<Lecture | null> {
  return lectureRepository.getLectureById(id);
}

export async function createLecture(input: LectureInput): Promise<Lecture> {
  await lectureRepository.ensureSheetHeaders();
  return lectureRepository.createLecture(input);
}

export async function updateLecture(
  id: string,
  input: Partial<LectureInput>,
): Promise<Lecture | null> {
  return lectureRepository.updateLecture(id, input);
}

export async function deleteLecture(id: string): Promise<boolean> {
  return lectureRepository.deleteLecture(id);
}

export async function ensureSheetHeaders(): Promise<void> {
  return lectureRepository.ensureSheetHeaders();
}
