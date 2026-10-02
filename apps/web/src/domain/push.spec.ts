import { describe, expect, it } from "vitest";
import { keyBytes, pushStateOf, shouldPromptForPush, type PushEnvironment } from "./push";

const env = (over: Partial<PushEnvironment> = {}): PushEnvironment => ({
  supported: true,
  isIos: false,
  standalone: false,
  permission: "default",
  subscribed: false,
  ...over,
});

describe("pushStateOf", () => {
  it("is on only with permission and a subscription", () => {
    expect(pushStateOf(env({ permission: "granted", subscribed: true }))).toBe("on");
    expect(pushStateOf(env({ permission: "granted", subscribed: false }))).toBe("off");
    expect(pushStateOf(env())).toBe("off");
  });

  it("is blocked once the member said no", () => {
    expect(pushStateOf(env({ permission: "denied" }))).toBe("blocked");
  });

  it("asks iPhone Safari to install first, but not the installed app", () => {
    expect(pushStateOf(env({ isIos: true, supported: false }))).toBe("install");
    expect(pushStateOf(env({ isIos: true, standalone: true }))).toBe("off");
  });

  it("is unsupported where there's no push at all", () => {
    expect(pushStateOf(env({ supported: false }))).toBe("unsupported");
  });
});

describe("shouldPromptForPush", () => {
  it("prompts when it could help, until dismissed", () => {
    expect(shouldPromptForPush("off", false)).toBe(true);
    expect(shouldPromptForPush("install", false)).toBe(true);
    expect(shouldPromptForPush("off", true)).toBe(false);
    for (const s of ["on", "blocked", "unsupported", null] as const) {
      expect(shouldPromptForPush(s, false)).toBe(false);
    }
  });
});

describe("keyBytes", () => {
  it("decodes base64url without padding", () => {
    // "Kink" is S2luaw== in base64.
    expect(Array.from(keyBytes("S2luaw"))).toEqual([75, 105, 110, 107]);
    expect(Array.from(keyBytes("-_8"))).toEqual([251, 255]);
  });
});
