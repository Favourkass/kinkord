const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Every API call in the web app goes through here so credentials (the Better
 * Auth session cookie) and the base URL are set in one place. Cookies flow
 * because the API is same-site in dev (both localhost) and behind one domain
 * in production.
 */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
