const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(
      typeof body === "string"
        ? body
        : ((body as { message?: string })?.message ?? `HTTP ${status}`),
    );
  }
}

/** status 0 marks a transport-level failure (offline, dropped, timed out). */
const NETWORK_MESSAGE = "Network problem — check your connection and try again.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    // fetch() rejects (TypeError "Failed to fetch") only on transport failure.
    throw new ApiError(0, NETWORK_MESSAGE);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export interface UploadOptions {
  retries?: number;
  timeoutMs?: number;
}

/**
 * Uploads a file straight to S3 via a presigned URL. Retries transient
 * failures (dropped connection, timeout) with backoff — essential on the
 * slow, variable mobile networks most members are on.
 */
export async function uploadToPresignedUrl(
  url: string,
  file: File,
  { retries = 2, timeoutMs = 60_000 }: UploadOptions = {},
): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return;
      // 4xx is a real rejection (bad key/type) — retrying won't help.
      if (res.status >= 400 && res.status < 500) {
        throw new ApiError(res.status, "Upload was rejected. Please try a different image.");
      }
      throw new ApiError(res.status, "upload failed");
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
      if (attempt === retries) {
        throw new ApiError(
          0,
          "Upload failed — your connection dropped. Try again on a stronger network.",
        );
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}
