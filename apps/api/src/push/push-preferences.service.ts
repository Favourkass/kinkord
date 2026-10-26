import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { pushPreference } from "../db/schema";
import { PUSH_GROUPS, type PushGroup } from "./push-policy";

export type PushSettings = Record<PushGroup, boolean>;

const patchSchema = z
  .object(
    Object.fromEntries(PUSH_GROUPS.map((g) => [g, z.boolean().optional()])) as Record<
      PushGroup,
      z.ZodOptional<z.ZodBoolean>
    >,
  )
  .strict();

function settingsFrom(off: readonly string[]): PushSettings {
  return Object.fromEntries(PUSH_GROUPS.map((g) => [g, !off.includes(g)])) as PushSettings;
}

/** Settings → Notifications: which kinds reach the member's devices. Everything is on until turned off. */
@Injectable()
export class PushPreferencesService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async get(userId: string): Promise<{ settings: PushSettings }> {
    return { settings: settingsFrom(await this.offFor(userId)) };
  }

  async update(userId: string, body: unknown): Promise<{ settings: PushSettings }> {
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Choose on or off for each kind.");
    const off = new Set(await this.offFor(userId));
    for (const [group, on] of Object.entries(parsed.data) as Array<[PushGroup, boolean]>) {
      if (on) off.delete(group);
      else off.add(group);
    }
    const next = PUSH_GROUPS.filter((g) => off.has(g));
    await this.db
      .insert(pushPreference)
      .values({ userId, off: next })
      .onConflictDoUpdate({
        target: pushPreference.userId,
        set: { off: next, updatedAt: sql`now()` },
      });
    return { settings: settingsFrom(next) };
  }

  private async offFor(userId: string): Promise<string[]> {
    const [row] = await this.db
      .select({ off: pushPreference.off })
      .from(pushPreference)
      .where(eq(pushPreference.userId, userId))
      .limit(1);
    return row?.off ?? [];
  }
}
