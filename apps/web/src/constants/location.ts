/** GeoNames' place names are CC BY 4.0: credit them where members pick one. */
export const PLACE_NAMES_CREDIT = {
  text: "Place names: GeoNames,",
  licence: "CC BY 4.0",
  href: "https://creativecommons.org/licenses/by/4.0/",
} as const;

/** Under a picker that shows only the first matches. */
export const KEEP_TYPING = "Keep typing to narrow it down";

/** The pinned row that takes what was typed as the place: Use “Ikota”. */
export const typedPlaceLabel = (query: string) => `Use “${query}”`;
