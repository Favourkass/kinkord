import { communityStatsRepository } from "@/repositories/communityStats.repository";

export const COMMUNITY_STATS_REFRESH_MS = 60_000;

export const communityStatsService = {
  read: (signal?: AbortSignal) => communityStatsRepository.read(signal),
};
