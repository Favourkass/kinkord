import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch, optionMatcher, SEARCH_RESULT_LIMIT } from "./textSearch";

const options = (labels: string[]) => labels.map((label) => ({ value: label, label }));

describe("normalizeSearch", () => {
  it("ignores accents, apostrophes, hyphens, extra spaces and case", () => {
    expect(normalizeSearch("Lang’ata")).toBe("langata");
    expect(normalizeSearch("Lang'ata")).toBe("langata");
    expect(normalizeSearch("Ọ̀yọ́")).toBe("oyo");
    expect(normalizeSearch("  Elgeyo-Marakwet ")).toBe("elgeyo marakwet");
    expect(normalizeSearch("Murang`a   Town")).toBe("muranga town");
  });

  it("matches labels against an already-normalised query", () => {
    expect(matchesSearch("Murang’a", normalizeSearch("muranga"))).toBe(true);
    expect(matchesSearch("Ikeja", normalizeSearch("ikoyi"))).toBe(false);
    expect(matchesSearch("Ikeja", "")).toBe(true);
  });
});

describe("optionMatcher", () => {
  it("finds a place however it is spelled", () => {
    const match = optionMatcher(options(["Lang’ata", "Elgeyo-Marakwet", "Ọ̀yọ́"]));
    expect(match("langata").hits.map((o) => o.label)).toEqual(["Lang’ata"]);
    expect(match("elgeyo marakwet").hits.map((o) => o.label)).toEqual(["Elgeyo-Marakwet"]);
    expect(match("OYO").hits.map((o) => o.label)).toEqual(["Ọ̀yọ́"]);
  });

  it("puts names that start with the query first", () => {
    const match = optionMatcher(options(["Abikun", "Adeniki", "Ikeja", "Old Ikoyi"]));
    expect(match("ik").hits.map((o) => o.label)).toEqual([
      "Ikeja",
      "Old Ikoyi",
      "Abikun",
      "Adeniki",
    ]);
  });

  it("renders at most 50 and says when more matched", () => {
    const many = options(Array.from({ length: 120 }, (_, i) => `Town ${i}`));
    const match = optionMatcher(many);
    expect(match("")).toMatchObject({ more: true });
    expect(match("").hits).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(match("town 1")).toMatchObject({ more: false });
    expect(match("town 11").hits.map((o) => o.label)).toEqual([
      "Town 11",
      "Town 110",
      "Town 111",
      "Town 112",
      "Town 113",
      "Town 114",
      "Town 115",
      "Town 116",
      "Town 117",
      "Town 118",
      "Town 119",
    ]);
    expect(optionMatcher(options(["Aba"]))("")).toEqual({ hits: options(["Aba"]), more: false });
  });
});

it("keeps an exact town match visible ahead of more than 50 word-prefix matches", () => {
  const match = optionMatcher(
    options([...Array.from({ length: 70 }, (_, i) => `Area ${i} Mobile Home Park`), "Mobile"]),
  );
  const result = match("  MOBILE  ");
  expect(result.hits[0].label).toBe("Mobile");
  expect(result.hits).toHaveLength(SEARCH_RESULT_LIMIT);
  expect(result.more).toBe(true);
});
