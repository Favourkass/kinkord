import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedUrl = vi.fn(async () => "https://signed.example");
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const send = vi.fn();
const s3Config = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: unknown) {
      s3Config(config);
    }
    send = (...args: unknown[]) => send(...args);
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

type SignCall = [unknown, { input: Record<string, unknown> }, Record<string, unknown>];
const lastSign = () => getSignedUrl.mock.calls[0] as unknown[] as SignCall;

describe("StorageService", () => {
  beforeEach(() => {
    vi.resetModules();
    getSignedUrl.mockClear();
    send.mockReset();
    s3Config.mockClear();
    process.env.MEDIA_BUCKET = "kinkord-media-test";
    delete process.env.S3_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it("uses plain AWS S3 (instance-role credentials) when no endpoint is configured", async () => {
    const { s3ClientConfig } = await import("./storage.service");
    expect(s3ClientConfig({ AWS_REGION: "eu-west-1" })).toEqual({ region: "eu-west-1" });
  });

  it("targets a local S3 with path-style addressing when S3_ENDPOINT is set", async () => {
    const { s3ClientConfig } = await import("./storage.service");
    // Local dev default: MinIO with no AWS credentials present at all.
    expect(s3ClientConfig({ S3_ENDPOINT: "http://localhost:9000" })).toEqual({
      region: "eu-west-1",
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
      credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
    });
    // Explicit credentials still win.
    expect(
      s3ClientConfig({
        S3_ENDPOINT: "http://minio:9000",
        AWS_ACCESS_KEY_ID: "k",
        AWS_SECRET_ACCESS_KEY: "s",
      }).credentials,
    ).toEqual({ accessKeyId: "k", secretAccessKey: "s" });
  });

  it("builds its client from that config", async () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    const { StorageService } = await import("./storage.service");
    new StorageService();
    expect(s3Config).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://localhost:9000", forcePathStyle: true }),
    );
  });

  it("presigns uploads with bucket, key, content type and short expiry", async () => {
    const { StorageService } = await import("./storage.service");
    const url = await new StorageService().presignUpload("avatars/u1/x.png", "image/png");
    expect(url).toBe("https://signed.example");
    const [, command, opts] = lastSign();
    expect(command.input).toEqual({
      Bucket: "kinkord-media-test",
      Key: "avatars/u1/x.png",
      ContentType: "image/png",
    });
    expect(opts.expiresIn).toBe(600);
  });

  it("signs a declared byte size into the upload so S3 rejects a different body", async () => {
    const { StorageService } = await import("./storage.service");
    await new StorageService().presignUpload("avatars/u1/x.jpg", "image/jpeg", 123_456);
    const [, command] = lastSign();
    expect(command.input.ContentLength).toBe(123_456);
  });

  it("presigns downloads with a stable per-hour URL, 2h validity and 1h cache-control", async () => {
    const { StorageService, DOWNLOAD_URL_WINDOW_S } = await import("./storage.service");
    const storage = new StorageService();
    await storage.presignDownload("avatars/u1/x.png", new Date("2026-09-08T15:47:12Z"));
    const [, command, opts] = lastSign();
    expect(command.input).toEqual({
      Bucket: "kinkord-media-test",
      Key: "avatars/u1/x.png",
      ResponseCacheControl: "private, max-age=3600",
    });
    expect(opts.expiresIn).toBe(DOWNLOAD_URL_WINDOW_S * 2);
    expect(opts.signingDate).toEqual(new Date("2026-09-08T15:00:00Z"));

    // Same hour → identical signing input; next hour → a new window.
    await storage.presignDownload("avatars/u1/x.png", new Date("2026-09-08T15:59:59Z"));
    expect((getSignedUrl.mock.calls[1] as unknown[] as SignCall)[2].signingDate).toEqual(
      new Date("2026-09-08T15:00:00Z"),
    );
    await storage.presignDownload("avatars/u1/x.png", new Date("2026-09-08T16:00:00Z"));
    expect((getSignedUrl.mock.calls[2] as unknown[] as SignCall)[2].signingDate).toEqual(
      new Date("2026-09-08T16:00:00Z"),
    );
  });

  it("describes an uploaded object from its HEAD response", async () => {
    const { StorageService } = await import("./storage.service");
    send.mockResolvedValueOnce({ ContentLength: 4096, ContentType: "image/webp" });
    const info = await new StorageService().describe("covers/u1/c.webp");
    expect(info).toEqual({ size: 4096, contentType: "image/webp" });
    expect((send.mock.calls[0][0] as { input: unknown }).input).toEqual({
      Bucket: "kinkord-media-test",
      Key: "covers/u1/c.webp",
    });
  });

  it("treats 404 and 403 (no ListBucket) HEAD failures as a missing object", async () => {
    const { StorageService } = await import("./storage.service");
    const storage = new StorageService();
    send.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    expect(await storage.describe("avatars/u1/nope.jpg")).toBeNull();
    send.mockRejectedValueOnce({ name: "Forbidden", $metadata: { httpStatusCode: 403 } });
    expect(await storage.describe("avatars/u1/nope.jpg")).toBeNull();
    send.mockRejectedValueOnce({ name: "InternalError", $metadata: { httpStatusCode: 500 } });
    await expect(storage.describe("avatars/u1/nope.jpg")).rejects.toBeTruthy();
  });

  it("removes objects best-effort without throwing", async () => {
    const { StorageService } = await import("./storage.service");
    send.mockRejectedValueOnce(new Error("boom"));
    await expect(new StorageService().remove("avatars/u1/x.jpg")).resolves.toBeUndefined();
    send.mockResolvedValueOnce({});
    await new StorageService().remove("avatars/u1/y.jpg");
    expect((send.mock.calls[1][0] as { input: unknown }).input).toEqual({
      Bucket: "kinkord-media-test",
      Key: "avatars/u1/y.jpg",
    });
  });
});
