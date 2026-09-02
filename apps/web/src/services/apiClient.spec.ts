import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, uploadToPresignedUrl } from "./apiClient";

const okJson = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const errJson = (status: number, data: unknown) =>
  ({ ok: false, status, json: async () => data }) as unknown as Response;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("api.request", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ members: 3 })));
    await expect(api.get("/community/stats")).resolves.toEqual({ members: 3 });
  });

  it("maps a transport failure to a friendly ApiError with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.get("/me")).rejects.toMatchObject({ status: 0 });
    await expect(api.get("/me")).rejects.toThrow(/connection/i);
  });

  it("throws ApiError carrying the server status and body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errJson(401, { message: "no session" })));
    await expect(api.get("/me")).rejects.toBeInstanceOf(ApiError);
    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
  });
});

describe("uploadToPresignedUrl", () => {
  const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

  it("succeeds on the first try when S3 returns ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadToPresignedUrl("https://s3/put", file)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries a dropped connection then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadToPresignedUrl("https://s3/put", file, { retries: 2, timeoutMs: 1000 }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries with a network message", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadToPresignedUrl("https://s3/put", file, { retries: 1, timeoutMs: 1000 }),
    ).rejects.toThrow(/connection dropped/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx rejection from S3", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadToPresignedUrl("https://s3/put", file, { retries: 3 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
