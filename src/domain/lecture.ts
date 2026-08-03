export interface LectureLink {
  label: string;
  url: string;
}

/** Domain persistence model (PM) */
export interface Lecture {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  links: LectureLink[];
  published: boolean;
  createdAt: string;
}

export type LectureInput = Omit<Lecture, "id" | "slug" | "createdAt">;

/** Display-ready lecture shape for UI */
export interface LectureVM {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  paragraphs: string[];
  links: LectureLink[];
  published: boolean;
  createdAt: string;
  createdAtLabel: string;
}

export function lectureToVM(lecture: Lecture): LectureVM {
  return {
    ...lecture,
    paragraphs: lecture.body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
    createdAtLabel: new Date(lecture.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}
