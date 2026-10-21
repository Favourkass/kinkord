import { describe, expect, it } from "vitest";
import { backupCodesText, groupedKey, setupKeyOf } from "./two-factor.service";

describe("setupKeyOf", () => {
  it("reads the setup key out of an authenticator link", () => {
    expect(
      setupKeyOf(
        "otpauth://totp/Kinkord:ada%40example.test?secret=jbswy3dpehpk3pxp&issuer=Kinkord",
      ),
    ).toBe("JBSWY3DPEHPK3PXP");
  });

  it("is null for a link with no key, or no link at all", () => {
    expect(setupKeyOf("otpauth://totp/Kinkord?issuer=Kinkord")).toBeNull();
    expect(setupKeyOf("not a link")).toBeNull();
  });
});

describe("groupedKey", () => {
  it("groups the key in fours for reading, with no space at the end", () => {
    expect(groupedKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(groupedKey("JBSWY3D")).toBe("JBSW Y3D");
  });
});

describe("backupCodesText", () => {
  it("puts one code on each line", () => {
    expect(backupCodesText(["aaaa-1111", "bbbb-2222"])).toBe("aaaa-1111\nbbbb-2222");
  });
});
