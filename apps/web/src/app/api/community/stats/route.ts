import { communityStatsRepository } from "@/repositories/communityStats.repository";

export async function GET() {
  const stats = await communityStatsRepository.readPlatform();
  return stats
    ? Response.json(stats, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ message: "Community count unavailable" }, { status: 503 });
}
