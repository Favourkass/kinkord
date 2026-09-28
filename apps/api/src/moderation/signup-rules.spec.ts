import { describe, expect, it } from "vitest";
import {
  clientIpFrom,
  evaluateSignup,
  normalizeEmail,
  normalizePhone,
  type SignupRule,
} from "./signup-rules";

describe("normalizeEmail", () => {
  it("folds Gmail's dots, + tags, case and googlemail into one mailbox", () => {
    for (const variant of [
      "ctolulope05@gmail.com",
      "C.Tolulope05@Gmail.com",
      "c.tolu.lope05+kinkord@gmail.com",
      "ctolulope05@googlemail.com",
      "  ctolulope05@gmail.com ",
    ]) {
      expect(normalizeEmail(variant)).toBe("ctolulope05@gmail.com");
    }
  });

  it("strips + tags elsewhere but keeps dots, which other providers treat as real", () => {
    expect(normalizeEmail("Tolu.D+x@yahoo.com")).toBe("tolu.d@yahoo.com");
  });

  it("keeps a local part that is only a tag rather than emptying it", () => {
    expect(normalizeEmail("+tag@gmail.com")).toBe("+tag@gmail.com");
  });
});

describe("normalizePhone", () => {
  it("reads the ways a Nigerian number gets written as one E.164 number", () => {
    for (const variant of ["+2349054291043", "+234 905 429 1043", "2349054291043", "09054291043"]) {
      expect(normalizePhone(variant)).toBe("+2349054291043");
    }
  });
});

describe("clientIpFrom", () => {
  const h = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});

  it("returns the single address a proxy recorded", () => {
    expect(clientIpFrom(h("102.89.84.23"))).toBe("102.89.84.23");
  });

  it("ignores an address the client forged on the left of the chain", () => {
    expect(clientIpFrom(h("1.2.3.4, 102.89.84.23"))).toBe("102.89.84.23");
  });

  it("skips AWS's own private hops on the right", () => {
    expect(clientIpFrom(h("102.89.84.23, 10.0.3.7, 169.254.1.1"))).toBe("102.89.84.23");
  });

  it("unwraps IPv4 addresses reported in IPv6 form", () => {
    expect(clientIpFrom(h("::ffff:102.93.7.171"))).toBe("102.93.7.171");
  });

  it("is null when there is no header", () => {
    expect(clientIpFrom(h())).toBeNull();
    expect(clientIpFrom(null)).toBeNull();
  });
});

describe("evaluateSignup", () => {
  const rules: SignupRule[] = [
    { kind: "email", value: "ctolulope05@gmail.com", action: "block" },
    { kind: "phone", value: "+2349054291043", action: "block" },
    { kind: "ip", value: "102.89.84.23", action: "flag" },
    { kind: "name", value: "durowara", action: "flag" },
  ];

  it("blocks the removed email even with a dot or a + tag added", () => {
    const verdict = evaluateSignup({ email: "c.tolulope05+new@gmail.com" }, rules);
    expect(verdict.action).toBe("block");
    expect(verdict.matches.map((m) => m.kind)).toEqual(["email"]);
  });

  it("blocks the phone however it was typed into the rule", () => {
    const typedLocally: SignupRule[] = [{ kind: "phone", value: "0905 429 1043", action: "block" }];
    expect(evaluateSignup({ phone: "+2349054291043" }, typedLocally).action).toBe("block");
  });

  it("flags a new email that carries the surname, so a human can look", () => {
    const verdict = evaluateSignup({ email: "tolu.durowara99@gmail.com", name: "Tolu C" }, rules);
    expect(verdict.action).toBe("flag");
    expect(verdict.matches.map((m) => m.kind)).toEqual(["name"]);
  });

  it("flags the surname in the display name, accents and case aside", () => {
    expect(evaluateSignup({ name: "DURÓWARA T." }, rules).action).toBe("flag");
  });

  it("flags rather than blocks a shared mobile IP", () => {
    expect(evaluateSignup({ ip: "102.89.84.23", email: "someone@else.com" }, rules).action).toBe(
      "flag",
    );
  });

  it("lets a block win when a flag also matched", () => {
    const verdict = evaluateSignup({ email: "ctolulope05@gmail.com", ip: "102.89.84.23" }, rules);
    expect(verdict.action).toBe("block");
    expect(verdict.matches).toHaveLength(2);
  });

  it("ignores name fragments too short to be specific", () => {
    const tooShort: SignupRule[] = [{ kind: "name", value: "Tol", action: "block" }];
    expect(evaluateSignup({ name: "Tolulope" }, tooShort).action).toBe("allow");
  });

  it("allows everyone else", () => {
    expect(
      evaluateSignup(
        {
          email: "tolulope.adeyemi@gmail.com",
          name: "Tolulope Adeyemi",
          phone: "+2348031234567",
          ip: "102.88.1.1",
        },
        rules,
      ),
    ).toEqual({ action: "allow", matches: [] });
  });
});
