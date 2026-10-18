import type { CommunityStatsPM } from "@/domain/communityStats";

async function readCount(url: string, signal?: AbortSignal): Promise<CommunityStatsPM | null> {
  try {
    const response = await fetch(url, { credentials: "omit", cache: "no-store", signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("members" in data)) return null;
    const members = data.members;
    return typeof members === "number" && Number.isSafeInteger(members) && members >= 0
      ? { members }
      : null;
  } catch {
    return null;
  }
}

export const communityStatsRepository = {
  read: (signal?: AbortSignal) => readCount("/api/community/stats", signal),
  readPlatform: () =>
    readCount(
      `${(process.env.NODE_ENV === "development" && process.env.KINKORD_DEV_API_PROXY) || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/community/public-stats`,
      AbortSignal.timeout(5_000),
    ),
};
