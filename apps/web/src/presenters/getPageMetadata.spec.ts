import { describe, expect, it } from "vitest";
import { getPageMetadata } from "./getPageMetadata";

describe("getPageMetadata", () => {
  const copy = { title: "About Kinkord", description: "Where it started." };

  it("gives a page its own canonical address and a full link preview", () => {
    expect(getPageMetadata("/about", copy)).toMatchObject({
      title: "About Kinkord",
      description: "Where it started.",
      alternates: { canonical: "/about" },
      openGraph: {
        type: "website",
        siteName: "Kinkord",
        locale: "en_NG",
        url: "/about",
        title: "About Kinkord",
        description: "Where it started.",
      },
      twitter: { card: "summary", title: "About Kinkord" },
    });
  });

  it("always includes a preview image, since a page's openGraph replaces its parent's", () => {
    const og = getPageMetadata("/", copy).openGraph as { images: Array<{ url: string }> };
    expect(og.images[0].url).toBe("/icons/icon-512x512.png");
  });
});
