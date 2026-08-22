import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedUrl = vi.fn(async () => "https://signed.example");
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

describe("StorageService", () => {
  beforeEach(() => {
    vi.resetModules();
    getSignedUrl.mockClear();
    process.env.MEDIA_BUCKET = "kinkord-media-test";
  });

  it("presigns uploads with bucket, key, content type and short expiry", async () => {
    const { StorageService } = await import("./storage.service");
    const url = await new StorageService().presignUpload("avatars/u1/x.png", "image/png");
    expect(url).toBe("https://signed.example");
    const [, command, opts] = getSignedUrl.mock.calls[0] as unknown[] as [
      unknown,
      { input: { Bucket: string; Key: string; ContentType: string } },
      { expiresIn: number },
    ];
    expect(command.input).toEqual({
      Bucket: "kinkord-media-test",
      Key: "avatars/u1/x.png",
      ContentType: "image/png",
    });
    expect(opts.expiresIn).toBe(600);
  });

  it("presigns downloads with a longer expiry", async () => {
    const { StorageService } = await import("./storage.service");
    await new StorageService().presignDownload("avatars/u1/x.png");
    const [, command, opts] = getSignedUrl.mock.calls[0] as unknown[] as [
      unknown,
      { input: { Bucket: string; Key: string } },
      { expiresIn: number },
    ];
    expect(command.input.Key).toBe("avatars/u1/x.png");
    expect(opts.expiresIn).toBe(3600);
  });
});
