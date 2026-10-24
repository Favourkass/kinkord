/* Run after building apps/api. Uses temporary tables and always rolls back.
 * KINKORD_PRIVACY_TEST_DATABASE_URL must point to a local test database. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../apps/api/package.json"));
const { Client } = req("pg");
const { sql, eq } = req("drizzle-orm");
const { drizzle } = req("drizzle-orm/node-postgres");
const { PgDialect } = req("drizzle-orm/pg-core");
const { privacyAllows, privateProfileValue, PRIVACY_FIELDS } = req("./dist/privacy/privacy-policy");
const { profile } = req("./dist/db/schema");
const connectionString = process.env.KINKORD_PRIVACY_TEST_DATABASE_URL;
if (!connectionString)
  throw new Error("Set KINKORD_PRIVACY_TEST_DATABASE_URL to a local test database.");
const url = new URL(connectionString);
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.includes("test"),
  "Local test databases only",
);
const client = new Client({ connectionString });
const dialect = new PgDialect();
let assertions = 0;
async function check(viewer, expected, field = "bio", owner = "owner") {
  const query = dialect.sqlToQuery(sql`select ${privacyAllows(viewer, owner, field)} as allowed`);
  const { rows } = await client.query(query.sql, query.params);
  assert.equal(rows[0].allowed, expected, `${field} / ${viewer}`);
  assertions++;
  const selected = await drizzle(client)
    .select({ allowed: privacyAllows(viewer, profile.userId, field) })
    .from(profile)
    .where(eq(profile.userId, owner));
  assert.equal(selected[0].allowed, expected, `${field} / ${viewer} via single-table select`);
  assertions++;
}
async function audience(value, field = "bio") {
  await client.query(
    "insert into profile_privacy values ($1, $2::jsonb) on conflict(user_id) do update set settings=profile_privacy.settings || excluded.settings",
    ["owner", JSON.stringify({ [field]: value })],
  );
}
(async () => {
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`
   create temp table profile(user_id text primary key, country text, profile_visibility text default 'public', avatar_key text, date_of_birth date, gender text, bio text, team_member boolean default false);
   create temp table profile_privacy(user_id text primary key, settings jsonb);
   create temp table follow(follower_id text, following_id text);
   create temp table friendship(user_a text, user_b text, status text);
   create temp table member_block(blocker_id text, blocked_id text);
   create temp table bronze_verification(user_id text, status text, verified_avatar_key text, verified_dob text, verified_gender text);
   insert into profile(user_id,country,avatar_key,date_of_birth,gender,bio) values
    ('owner','NG','owner.jpg','1990-01-01','Male','private biography'),
    ('same','NG','same.jpg','1990-01-01','Male',''),
    ('africa','GH','africa.jpg','1990-01-01','Male',''),
    ('abroad','US','abroad.jpg','1990-01-01','Female',''),
    ('unknown',null,null,null,null,'');
  `);
    await check("abroad", true);
    await client.query("update profile set profile_visibility='friends' where user_id='owner'");
    await check("same", false);
    await check("owner", true);
    // Ensure fallback is correlated to the outer profile, not an accidental self-join.
    let query = dialect.sqlToQuery(
      sql`select ${privateProfileValue("same", profile.userId, "bio", profile.bio)} as bio from ${profile} where ${profile.userId}='owner'`,
    );
    assert.equal((await client.query(query.sql, query.params)).rows[0].bio, null);
    assertions++;
    await audience("members");
    await check("abroad", true);
    await audience("friends");
    await check("same", false);
    await client.query("insert into follow values ('same','owner'),('owner','same')");
    await check("same", false); // Mutual following is not a friendship.
    await client.query("insert into friendship values ('owner','same','pending')");
    await check("same", false);
    await client.query("update friendship set status='accepted'");
    await check("same", true);
    await client.query("truncate follow");
    await client.query("insert into follow values ('same','owner')");
    await audience("followers");
    await check("same", true);
    await check("africa", false);
    await audience("following");
    await check("same", false);
    await client.query("insert into follow values ('owner','africa')");
    await check("africa", true);
    await audience("country");
    await check("same", true);
    await check("africa", false);
    await check("unknown", false);
    await audience("continent");
    await check("same", true);
    await check("africa", true);
    await check("abroad", false);
    await check("unknown", false);
    await audience("verified");
    await check("same", false);
    await client.query("update profile set team_member=true where user_id='same'");
    await check("same", false);
    await client.query(
      "insert into bronze_verification values ('same','verified','same.jpg','1990-01-01','Male')",
    );
    await check("same", true);
    await client.query("update profile set avatar_key='changed.jpg' where user_id='same'");
    await check("same", false);
    await client.query(
      "update profile set avatar_key='same.jpg',gender='Female' where user_id='same'",
    );
    await check("same", false);
    await client.query(
      "update profile set gender='Male',date_of_birth='1991-01-01' where user_id='same'",
    );
    await check("same", false);
    for (const field of PRIVACY_FIELDS) {
      await audience("country", field);
      await check("same", true, field);
      await check("abroad", false, field);
      await check("owner", true, field);
    }
    await client.query("insert into member_block values ('owner','same')");
    await check("same", false);
    await client.query("truncate member_block; insert into member_block values ('same','owner')");
    await check("same", false);
    await client.query("truncate member_block, profile_privacy, follow, friendship");
    await client.query("update profile set profile_visibility='public'");
    // A restrictive viewer cannot bypass reciprocity by querying a permissive owner.
    for (const field of PRIVACY_FIELDS) {
      await client.query(
        "insert into profile_privacy values ('same',$1::jsonb) on conflict(user_id) do update set settings=excluded.settings",
        [JSON.stringify({ [field]: "onlyMe" })],
      );
      await check("same", false, field);
      await check("owner", false, field, "same");
      await check("same", true, field, "same");
    }
    for (const [choice, allowed] of [
      ["members", true],
      ["friends", false],
      ["followers", false],
      ["following", false],
      ["country", true],
      ["continent", true],
      ["verified", false],
      ["onlyMe", false],
    ]) {
      await client.query("update profile_privacy set settings=$1::jsonb where user_id='same'", [
        JSON.stringify({ profilePhoto: choice }),
      ]);
      await check("same", allowed, "profilePhoto");
      await check("owner", allowed, "profilePhoto", "same");
    }
    await client.query(
      "update profile_privacy set settings='{\"profilePhoto\":\"followers\"}' where user_id='same'; insert into follow values ('owner','same')",
    );
    await check("same", true, "profilePhoto");
    await check("owner", true, "profilePhoto", "same");
    await client.query(
      "update profile_privacy set settings='{\"profilePhoto\":\"following\"}' where user_id='same'",
    );
    await check("same", false, "profilePhoto");
    await client.query("insert into follow values ('same','owner')");
    await check("same", true, "profilePhoto");
    await client.query(
      "update profile_privacy set settings='{\"profilePhoto\":\"friends\"}' where user_id='same'; insert into friendship values ('owner','same','accepted')",
    );
    await check("same", true, "profilePhoto");

    console.log(`Privacy SQL integration: ${assertions} assertions passed; no persistent changes.`);
  } finally {
    await client.query("rollback");
    await client.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
