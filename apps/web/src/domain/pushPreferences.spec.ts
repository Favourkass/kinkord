import { describe, expect, it } from "vitest";
import { PUSH_GROUP_KEYS, pushPreferencesFromTransport } from "./pushPreferences";

const allOn = Object.fromEntries(PUSH_GROUP_KEYS.map((key) => [key, true]));

describe("pushPreferencesFromTransport", () => {
  it("reads an on/off for every kind", () => {
    expect(pushPreferencesFromTransport({ settings: { ...allOn, likes: false } })).toEqual({
      settings: { ...allOn, likes: false },
    });
  });

  it("refuses a response missing a kind or using anything but true/false", () => {
    const missing: Record<string, boolean> = { ...allOn };
    delete missing.likes;
    expect(() => pushPreferencesFromTransport({ settings: missing })).toThrow();
    expect(() => pushPreferencesFromTransport({ settings: { ...allOn, likes: "off" } })).toThrow();
    expect(() => pushPreferencesFromTransport(null)).toThrow();
  });
});
