import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { appSetting } from "../db/schema";

/**
 * - off: no checks at all
 * - watch: checks run and are recorded, but never stop anyone
 * - enforce: the decisions apply
 */
export const LOCATION_CHECK_MODES = ["off", "watch", "enforce"] as const;
export type LocationCheckMode = (typeof LOCATION_CHECK_MODES)[number];

/**
 * Off until the founders switch it on in Moderation → Location, so the release
 * can't hold members whose open app predates it. Then watch first (founder,
 * 2026-11-02): for about a week the page shows who would have been stopped,
 * and the founders switch to enforce there.
 */
export const DEFAULT_LOCATION_CHECK_MODE: LocationCheckMode = "off";
const MODE_KEY = "location_check_mode";
/** Every request reads the mode, so each instance holds it this long; a switch spreads within it. */
const CACHE_MS = 30_000;

const isMode = (value: string | undefined): value is LocationCheckMode =>
  (LOCATION_CHECK_MODES as readonly string[]).includes(value ?? "");

@Injectable()
export class LocationSettingsService {
  private cached: { mode: LocationCheckMode; until: number } | null = null;
  /** The read in flight, shared by every request that arrives while it runs. */
  private reading: Promise<LocationCheckMode> | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  mode(now = Date.now()): Promise<LocationCheckMode> {
    if (this.cached && this.cached.until > now) return Promise.resolve(this.cached.mode);
    this.reading ??= this.read(now).finally(() => {
      this.reading = null;
    });
    return this.reading;
  }

  private async read(now: number): Promise<LocationCheckMode> {
    const [row] = await this.db
      .select({ value: appSetting.value })
      .from(appSetting)
      .where(eq(appSetting.key, MODE_KEY))
      .limit(1);
    const mode = isMode(row?.value) ? row.value : DEFAULT_LOCATION_CHECK_MODE;
    this.cached = { mode, until: now + CACHE_MS };
    return mode;
  }

  async setMode(mode: LocationCheckMode, byUserId: string): Promise<LocationCheckMode> {
    await this.db
      .insert(appSetting)
      .values({ key: MODE_KEY, value: mode, updatedBy: byUserId })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value: mode, updatedBy: byUserId, updatedAt: new Date() },
      });
    this.cached = null;
    return mode;
  }
}
