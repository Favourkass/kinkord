export interface LectureLink {
  label: string;
  url: string;
}

export interface Lecture {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;          // newline-separated paragraphs
  links: LectureLink[];  // external video / resource links
  published: boolean;
  createdAt: string;     // ISO date string
}

export type LectureInput = Omit<Lecture, "id" | "slug" | "createdAt">;
