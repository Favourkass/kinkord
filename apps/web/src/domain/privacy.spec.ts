import { describe, it, expect } from "vitest";
import { PRIVACY_FIELD_KEYS, privacyFromTransport } from "./privacy";
describe("privacy domain mapping", () => {
  const settings = Object.fromEntries(PRIVACY_FIELD_KEYS.map((key) => [key, "members"]));
  it("maps only known settings and discards transport extras", () => {
    const model = privacyFromTransport({
      settings: { ...settings, secret: "unexpected" },
      userId: "other",
    });
    expect(model).toEqual({ settings });
  });
  it.each([
    null,
    {},
    { settings: {} },
    { settings: { ...settings, bio: ["friends", "members"] } },
    { settings: { ...settings, bio: "premium" } },
  ])("rejects malformed settings %j", (value) => {
    expect(() => privacyFromTransport(value)).toThrow();
  });
});
