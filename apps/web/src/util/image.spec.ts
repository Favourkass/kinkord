// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImage } from "./image";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compressImage", () => {
  it("passes non-image files through unchanged", async () => {
    const pdf = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("passes animated GIFs through unchanged (canvas would flatten them)", async () => {
    const gif = new File([new Uint8Array(1024)], "loop.gif", { type: "image/gif" });
    expect(await compressImage(gif)).toBe(gif);
  });

  it("fails safe to the original file when the image can't be decoded", async () => {
    // Force the decode path to reject deterministically (no real canvas in jsdom);
    // the util must swallow it and hand back the untouched file, never throw/hang.
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode unavailable")));
    const jpg = new File([new Uint8Array(9_000_000)], "huge.jpg", { type: "image/jpeg" });
    const out = await compressImage(jpg);
    expect(out).toBe(jpg);
  });
});
