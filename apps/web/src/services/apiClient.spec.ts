import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, uploadToPresignedUrl } from "./apiClient";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

describe("api", () => {
  it("sends credentials and json headers, returns parsed body", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) });
    const out = await api.patch("/profile", { bio: "x" });
    expect(out).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/profile$/);
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ bio: "x" });
  });

  it("throws ApiError with status and body on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Not signed in" }),
    });
    await expect(api.get("/me")).rejects.toMatchObject({ status: 401, message: "Not signed in" });
  });
});

describe("uploadToPresignedUrl", () => {
  it("PUTs the raw file with its content type", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const file = new File(["x"], "a.png", { type: "image/png" });
    await uploadToPresignedUrl("https://s3/x", file);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.headers["content-type"]).toBe("image/png");
  });

  it("throws ApiError on a failed upload", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const file = new File(["x"], "a.png", { type: "image/png" });
    await expect(uploadToPresignedUrl("https://s3/x", file)).rejects.toBeInstanceOf(ApiError);
  });
});
