import { Inject, Injectable } from "@nestjs/common";
import { count } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { user } from "../db/schema";

@Injectable()
export class CommunityService {
  private publicSnapshot: { expiresAt: number; value: Promise<{ members: number }> } | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** Share one aggregate query across guests for a minute; never expose member records. */
  publicStats() {
    if (this.publicSnapshot && this.publicSnapshot.expiresAt > Date.now()) {
      return this.publicSnapshot.value;
    }
    const value = this.stats().catch((error) => {
      if (this.publicSnapshot?.value === value) this.publicSnapshot = null;
      throw error;
    });
    this.publicSnapshot = { expiresAt: Date.now() + 60_000, value };
    return value;
  }

  async stats() {
    const [row] = await this.db.select({ members: count() }).from(user);
    return { members: row?.members ?? 0 };
  }
}
