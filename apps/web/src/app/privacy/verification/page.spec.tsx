import { describe, expect, it } from "vitest";
import { metadata } from "./page";

describe("verification privacy metadata", () => {
  it("keeps the draft notice out of search indexes until legal approval", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
