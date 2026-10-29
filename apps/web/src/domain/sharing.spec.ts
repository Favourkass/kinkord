import { describe, expect, it } from "vitest";
import { shareText } from "./sharing";

describe("shareText", () => {
  it("puts the caption above the link", () => {
    expect(shareText("  Worth a read ", "https://kinkord.com/p/a")).toBe(
      "Worth a read\n\nhttps://kinkord.com/p/a",
    );
  });
  it("is just the link without a caption", () => {
    expect(shareText("   ", "https://kinkord.com/p/a")).toBe("https://kinkord.com/p/a");
  });
});
