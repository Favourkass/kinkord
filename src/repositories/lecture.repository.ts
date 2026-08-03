import { google } from "googleapis";
import type { Lecture, LectureInput } from "@/domain/lecture";
import { generateId, slugify } from "@/util/slug";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID ?? "";
const RANGE = "Lectures!A:H";

function rowToLecture(row: string[]): Lecture {
  return {
    id: row[0] ?? "",
    slug: row[1] ?? "",
    title: row[2] ?? "",
    category: row[3] ?? "",
    body: row[4] ?? "",
    links: (() => {
      try {
        return JSON.parse(row[5] ?? "[]");
      } catch {
        return [];
      }
    })(),
    published: row[6] === "true",
    createdAt: row[7] ?? new Date().toISOString(),
  };
}

function lectureToRow(l: Lecture): string[] {
  return [
    l.id,
    l.slug,
    l.title,
    l.category,
    l.body,
    JSON.stringify(l.links),
    String(l.published),
    l.createdAt,
  ];
}

export async function getLectures(publishedOnly = true): Promise<Lecture[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: RANGE,
  });
  const rows = (res.data.values ?? []).slice(1);
  const lectures = rows.map(rowToLecture).filter((l) => l.id !== "");
  return publishedOnly ? lectures.filter((l) => l.published) : lectures;
}

export async function getLectureById(id: string): Promise<Lecture | null> {
  const all = await getLectures(false);
  return all.find((l) => l.id === id) ?? null;
}

export async function getLectureBySlug(slug: string): Promise<Lecture | null> {
  const all = await getLectures(false);
  return all.find((l) => l.slug === slug) ?? null;
}

export async function createLecture(input: LectureInput): Promise<Lecture> {
  const lecture: Lecture = {
    ...input,
    id: generateId(),
    slug: slugify(input.title),
    createdAt: new Date().toISOString(),
  };

  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: RANGE,
    valueInputOption: "RAW",
    requestBody: { values: [lectureToRow(lecture)] },
  });

  return lecture;
}

export async function updateLecture(
  id: string,
  input: Partial<LectureInput>,
): Promise<Lecture | null> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: RANGE,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex === -1) return null;

  const existing = rowToLecture(rows[rowIndex]);
  const updated: Lecture = { ...existing, ...input };
  if (input.title) updated.slug = slugify(input.title);

  const sheetRow = rowIndex + 1;
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Lectures!A${sheetRow}:H${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [lectureToRow(updated)] },
  });

  return updated;
}

export async function deleteLecture(id: string): Promise<boolean> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: RANGE,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex === -1) return false;

  const meta = await sheets().spreadsheets.get({ spreadsheetId: SHEET_ID() });
  const sheetGid = meta.data.sheets?.[0]?.properties?.sheetId ?? 0;

  await sheets().spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

export async function ensureSheetHeaders(): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "Lectures!A1:H1",
  });
  const first = res.data.values?.[0];
  if (!first || first[0] !== "id") {
    await sheets().spreadsheets.values.update({
      spreadsheetId: SHEET_ID(),
      range: "Lectures!A1:H1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["id", "slug", "title", "category", "body", "links", "published", "createdAt"]],
      },
    });
  }
}
