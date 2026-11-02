import { describe, expect, it } from "vitest";
import { getLocationPrivacyVM } from "./getLocationPrivacyVM";

describe("getLocationPrivacyVM", () => {
  const vm = getLocationPrivacyVM();

  it("says what is looked at, what is kept, how it decides, and who sees it", () => {
    expect(vm.sections.map((s) => s.id)).toEqual(["what", "keep", "decide", "who"]);
    expect(vm.sections[1].paragraphs.join(" ")).toMatch(/exact position is never stored/);
    expect(vm.sections[1].paragraphs.join(" ")).toMatch(/90 days/);
  });

  it("credits DB-IP, as its licence asks", () => {
    expect(vm.provider).toMatchObject({
      linkLabel: "IP Geolocation by DB-IP ↗",
      href: "https://db-ip.com",
    });
    expect(vm.provider.body).toMatch(/Creative Commons Attribution 4\.0/);
  });

  it("links home and to contact", () => {
    expect(vm).toMatchObject({ homeHref: "/", contactHref: "/contact" });
  });
});
