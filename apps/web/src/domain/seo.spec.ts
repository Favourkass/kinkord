import { describe, expect, it } from "vitest";
import { siteJsonLd, toJsonLdScript } from "./seo";

const facts = {
  url: "https://kinkord.com",
  name: "Kinkord",
  description: "BDSM & kink community in Nigeria",
  logo: "https://kinkord.com/icons/icon-512x512.png",
  sameAs: ["https://x.com/kinkordofficial"],
  alternateNames: ["BKCN", "BDSM and Kinks Club Nigeria"],
};

describe("siteJsonLd", () => {
  it("describes the organisation, its earlier names and accounts, and the site it publishes", () => {
    const data = siteJsonLd(facts);
    const [org, site] = data["@graph"];
    expect(data["@context"]).toBe("https://schema.org");
    expect(org).toMatchObject({
      "@type": "Organization",
      "@id": "https://kinkord.com/#organization",
      name: "Kinkord",
      alternateName: ["BKCN", "BDSM and Kinks Club Nigeria"],
      url: "https://kinkord.com/",
      foundingLocation: { "@type": "Country", name: "Nigeria" },
      sameAs: ["https://x.com/kinkordofficial"],
    });
    expect(site).toMatchObject({
      "@type": "WebSite",
      inLanguage: "en-NG",
      publisher: { "@id": "https://kinkord.com/#organization" },
    });
  });
});

describe("toJsonLdScript", () => {
  it("can't be broken out of its script tag", () => {
    const json = toJsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
