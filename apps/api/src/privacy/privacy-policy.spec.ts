import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { profile } from "../db/schema";
import { effectivePrivacy, privacyAllows, privateProfileValue } from "./privacy-policy";
describe("privacy policy", () => {
  it("preserves legacy About privacy and gives explicit field choices precedence", () => {
    expect(effectivePrivacy({ bio: "country" }, "friends")).toMatchObject({
      bio: "country",
      interests: "friends",
      media: "friends",
      directory: "members",
    });
  });
  it("binds user identifiers as values rather than SQL", () => {
    const viewer = "x' or true --";
    const query = new PgDialect().sqlToQuery(privacyAllows(viewer, "owner", "bio"));
    expect(query.sql).not.toContain(viewer);
    expect(query.params).toContain(viewer);
    expect(query.sql).toContain("verified_avatar_key=v.avatar_key");
    expect(query.sql).not.toContain("member_subscription");
  });
  it("keeps outer columns qualified in a single-table SELECT and its inner queries", () => {
    const db = drizzle.mock();
    const query = db
      .select({
        allowed: privacyAllows("viewer", profile.userId, "location"),
        photo: privateProfileValue("viewer", profile.userId, "profilePhoto", profile.avatarKey),
      })
      .from(profile)
      .toSQL();
    expect(query.sql).toContain('o.user_id="profile"."user_id"');
    expect(query.sql).not.toContain('o.user_id="user_id"');
    expect(query.sql).toContain('following_id="profile"."user_id"');
  });
  it("honours an aliased outer owner", () => {
    const peer = alias(profile, "peer");
    const query = new PgDialect().sqlToQuery(sql`${privacyAllows("viewer", peer.userId, "bio")}`);
    expect(query.sql).toContain('privacy_owner.user_id="peer"."user_id"');
    expect(query.sql).not.toContain('privacy_owner.user_id="profile"."user_id"');
  });
});
