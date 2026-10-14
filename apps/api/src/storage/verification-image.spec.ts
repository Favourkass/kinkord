import { describe, expect, it } from "vitest";
import {
  VERIFICATION_IMAGE_MAX_BYTES,
  publicImageAddress,
  verificationImage,
} from "./verification-image";

describe("verification image safety", () => {
  it("recognises supported images from their bytes rather than upload metadata", () => {
    expect(verificationImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toMatchObject({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(verificationImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]))).toMatchObject({
      contentType: "image/png",
      extension: "png",
    });
    expect(verificationImage(Buffer.from("RIFFxxxxWEBP"))).toMatchObject({
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("rejects unsupported and oversized payloads", () => {
    expect(() => verificationImage(Buffer.alloc(0))).toThrow("Invalid verification image size");
    expect(() => verificationImage(Buffer.alloc(VERIFICATION_IMAGE_MAX_BYTES + 1))).toThrow(
      "Invalid verification image size",
    );
    expect(() => verificationImage(Buffer.from("GIF89a"))).toThrow(
      "Unsupported verification image",
    );
  });

  it("allows public IPv4 and rejects local, private, reserved and malformed addresses", () => {
    expect(publicImageAddress("8.8.8.8")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.1.1",
      "203.0.113.5",
      "999.1.1.1",
      "::1",
    ]) {
      expect(publicImageAddress(address)).toBe(false);
    }
  });
});
