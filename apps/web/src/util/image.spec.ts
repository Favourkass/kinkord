// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_UPLOAD_PRESETS, compressImage } from "./image";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IMAGE_UPLOAD_PRESETS", () => {
  it("keeps avatars far smaller than covers and both within the API's byte caps", () => {
    expect(IMAGE_UPLOAD_PRESETS.avatar.maxDim).toBeLessThan(IMAGE_UPLOAD_PRESETS.cover.maxDim);
    expect(IMAGE_UPLOAD_PRESETS.avatar.maxBytes).toBeLessThan(IMAGE_UPLOAD_PRESETS.cover.maxBytes);
    // API caps: avatar 5MB, cover 10MB — presets must sit well below them.
    expect(IMAGE_UPLOAD_PRESETS.avatar.maxBytes).toBeLessThan(5 * 1024 * 1024);
    expect(IMAGE_UPLOAD_PRESETS.cover.maxBytes).toBeLessThan(10 * 1024 * 1024);
  });

  it("returns an already-small file untouched under the avatar preset", async () => {
    // Below maxBytes and (as far as decode is concerned) already within maxDim.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 400, height: 400, close() {} })),
    );
    const small = new File([new Uint8Array(20_000)], "me.jpg", { type: "image/jpeg" });
    expect(await compressImage(small, IMAGE_UPLOAD_PRESETS.avatar)).toBe(small);
  });
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
