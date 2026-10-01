import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("robots.txt", () => {
  it("lets crawlers in, keeps them out of the API, and points at the sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://kinkord.com/sitemap.xml",
      host: "https://kinkord.com",
    });
  });
});

describe("sitemap.xml", () => {
  it("lists the public pages and nothing from the members' area", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      "https://kinkord.com/",
      "https://kinkord.com/about",
      "https://kinkord.com/about/team",
      "https://kinkord.com/contact",
      "https://kinkord.com/invest",
    ]);
    for (const url of urls) expect(url).not.toMatch(/\/(home|messages|members|u|p|profile)(\/|$)/);
  });
});
