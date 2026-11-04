import { describe, expect, it } from "vitest";
import { evaluateDevice, timezoneCountries } from "./device-signals";

const phone = {
  timezone: "Africa/Lagos",
  automation: false,
  geolocationNative: true,
  renderer: "Adreno (TM) 610",
};

describe("evaluateDevice", () => {
  it("finds nothing wrong with an ordinary phone", () => {
    expect(evaluateDevice(phone)).toEqual({
      automation: false,
      locationOverridden: false,
      emulator: false,
      timezoneCountries: expect.arrayContaining(["NG"]),
    });
  });

  it("notices automation and a geolocation answered by a script", () => {
    expect(evaluateDevice({ ...phone, automation: true, geolocationNative: false })).toMatchObject({
      automation: true,
      locationOverridden: true,
    });
  });

  it.each(["Google SwiftShader", "llvmpipe (LLVM 15.0.7, 256 bits)", "Android Emulator OpenGL ES"])(
    "notices the software renderer %s",
    (renderer) => {
      expect(evaluateDevice({ ...phone, renderer }).emulator).toBe(true);
    },
  );
});

describe("timezoneCountries", () => {
  it("returns every country a zone covers", () => {
    expect(timezoneCountries("Africa/Lagos")).toEqual(expect.arrayContaining(["NG", "BJ", "CM"]));
    expect(timezoneCountries("Africa/Johannesburg")).toEqual(expect.arrayContaining(["ZA"]));
  });

  it("understands old zone names, like Africa/Accra", () => {
    expect(timezoneCountries("Africa/Accra")).toEqual(["GH"]);
  });

  it("says nothing for UTC, unknown or missing zones", () => {
    expect(timezoneCountries("UTC")).toBeNull();
    expect(timezoneCountries("Mars/Olympus")).toBeNull();
    expect(timezoneCountries(null)).toBeNull();
  });
});
