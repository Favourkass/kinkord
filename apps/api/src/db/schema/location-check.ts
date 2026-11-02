import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Joining, a recheck the app asked for, or confirming a new country before switching to it. */
export type LocationCheckPurpose = "signup" | "recheck" | "change";

/**
 * What a check decided (location-check/country-check-rules.ts):
 * - approved: the GPS or the connection puts them in the country they chose
 * - travel: abroad outside Kinkord's countries, soon after a check at home
 * - mismatch: neither does
 * - retry: the GPS or the connection couldn't be read
 * - refused: clear signs of faking
 * - paused: too many failed tries in a day
 * - skipped: watch mode only, they chose not to share their location
 */
export type LocationCheckDecision =
  "approved" | "travel" | "mismatch" | "retry" | "refused" | "paused" | "skipped";

export type GpsStatus = "ok" | "denied" | "unavailable" | "timeout" | "unsupported" | "skipped";

/** A network the connection came through that hides where the person is. */
export type Anonymizer = "tor" | "hosting";

/**
 * Every country check, kept 90 days for the founders' page and the daily
 * attempt limits. Coordinates are never stored: only the country they fall in
 * and the reading's accuracy. The address is kept only as a keyed hash, like
 * sign-in failures, so nobody's IP sits here in the clear.
 */
export const locationCheck = pgTable(
  "location_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for a check made while joining, until the account it let in exists. */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<LocationCheckPurpose>().notNull(),
    selectedCountry: text("selected_country").notNull(),
    gpsStatus: text("gps_status").$type<GpsStatus>().notNull(),
    gpsCountry: text("gps_country"),
    gpsAccuracyM: integer("gps_accuracy_m"),
    ipCountry: text("ip_country"),
    ipAsn: integer("ip_asn"),
    /** Who runs the network, e.g. "MTN NIGERIA Communication limited". */
    ipNetwork: text("ip_network"),
    ipAnonymizer: text("ip_anonymizer").$type<Anonymizer>(),
    /** The device clock's zone, e.g. "Africa/Lagos". */
    timezone: text("timezone"),
    /** The deciding reason first, then every other signal worth seeing. */
    reasons: text("reasons")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    decision: text("decision").$type<LocationCheckDecision>().notNull(),
    /** False while the check only watches (founders' switch): the decision was recorded, not applied. */
    enforced: boolean("enforced").notNull(),
    networkKey: text("network_key"),
    /** A random id the browser keeps, so tries from one phone are counted together. */
    deviceId: text("device_id"),
    /** When an approved check was spent: on the account it let in, or on the country change it allowed. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("location_check_user_idx").on(t.userId, t.createdAt),
    index("location_check_device_idx").on(t.deviceId, t.createdAt),
    index("location_check_network_idx").on(t.networkKey, t.createdAt),
    index("location_check_created_idx").on(t.createdAt),
  ],
);

/** Where a member stands with the country check; written by every check that let them through. */
export type LocationStanding = "approved" | "travel" | "observed";

export const locationStatus = pgTable("location_status", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The last check that let them through. In watch mode, any recorded check counts ("observed"). */
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  /** The profile country that check was for; a new country needs a new check. */
  checkedCountry: text("checked_country").notNull(),
  status: text("status").$type<LocationStanding>().notNull(),
  /** The last check that found them in their own country. Travelling is allowed for 30 days after it. */
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  /** The last precise GPS reading, rounded to 0.1° (about 11 km), for spotting impossible travel. */
  cell: text("cell"),
  cellAt: timestamp("cell_at", { withTimezone: true }),
});

/** Switches the founders flip from the app, e.g. `location_check_mode`. */
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
