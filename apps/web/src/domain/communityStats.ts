export interface CommunityStatsPM {
  members: number;
}

export function communityStatsToVM(stats: CommunityStatsPM) {
  return { count: new Intl.NumberFormat("en-US").format(stats.members) };
}
