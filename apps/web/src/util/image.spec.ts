// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { compressImage } from "./image";

describe("compressImage", () => {
  it("passes non-image files through unchanged", async () => {
    const pdf = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("passes animated GIFs through unchanged (canvas would flatten them)", async () => {
    const gif = new File([new Uint8Array(1024)], "loop.gif", { type: "image/gif" });
    expect(await compressImage(gif)).toBe(gif);
  });

  it("returns the original when canvas decoding is unavailable (jsdom)", async () => {
    // jsdom has no real canvas/bitmap decode; the util must fail safe, never throw.
    const jpg = new File([new Uint8Array(9_000_000)], "huge.jpg", { type: "image/jpeg" });
    const out = await compressImage(jpg);
    expect(out).toBe(jpg);
  });
});
