import { describe, expect, it } from "vitest";
import {
  DS_TYPES,
  ROMANTIC_TYPES,
  relationshipKind,
  relationshipLabel,
  relationshipOptions,
  sideOf,
} from "./relationship-types";

describe("relationship types", () => {
  it("knows each type's kind, and offers nothing else", () => {
    expect(relationshipKind("dominant")).toBe("ds");
    expect(relationshipKind("brat_tamer")).toBe("ds");
    expect(relationshipKind("married")).toBe("romantic");
    expect(relationshipKind("Dominant")).toBeNull();
    expect(relationshipKind("boss")).toBeNull();
  });

  it("reads a D/s link from each side, the way kinksters write it", () => {
    expect(relationshipLabel("dominant", "dominant")).toBe("Dominant of");
    expect(relationshipLabel("dominant", "submissive")).toBe("submissive of");
    expect(relationshipLabel("owner", "submissive")).toBe("pet of");
    expect(relationshipLabel("daddy", "dominant")).toBe("Daddy of");
  });

  it("reads any other relationship the same from both sides", () => {
    expect(relationshipLabel("married", "partner")).toBe("Married to");
    expect(relationshipLabel("dating", "partner")).toBe("Dating");
  });

  it("puts whoever asked on the submissive side of a D/s link", () => {
    expect(sideOf({ kind: "ds", requesterId: "sub" }, "sub")).toBe("submissive");
    expect(sideOf({ kind: "ds", requesterId: "sub" }, "dom")).toBe("dominant");
    expect(sideOf({ kind: "romantic", requesterId: "a" }, "b")).toBe("partner");
  });

  it("offers every type once, with what each side is called", () => {
    const options = relationshipOptions();
    const keys = [...options.ds, ...options.romantic].map((o) => o.type);
    expect(new Set(keys).size).toBe(DS_TYPES.length + ROMANTIC_TYPES.length);
    expect(options.ds[0]).toEqual({
      type: "dominant",
      dominant: "Dominant",
      submissive: "submissive",
    });
    expect(options.romantic.find((o) => o.type === "fwb")?.label).toBe(
      "Friends with benefits with",
    );
  });
});
