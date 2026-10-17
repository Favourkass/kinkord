const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { Pool } = require(path.join(root, "node_modules/pg"));
const { drizzle } = require(path.join(root, "node_modules/drizzle-orm/node-postgres"));
const { alias } = require(path.join(root, "node_modules/drizzle-orm/pg-core"));
const schema = require(path.join(root, "dist/db/schema"));
const { FollowsService } = require(path.join(root, "dist/members/follows.service"));
const { FriendshipsService } = require(path.join(root, "dist/members/friendships.service"));
const { visibleTo } = require(path.join(root, "dist/posts/visibility"));
const url = new URL(process.env.FRIENDSHIP_TEST_DB_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname));
const dbName = "kinkord_friends_check_" + Date.now();
url.pathname = "/postgres";
const admin = new Pool({ connectionString: url.toString() });
let pool,
  client,
  created = false;
(async () => {
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  url.pathname = "/" + dbName;
  pool = new Pool({ connectionString: url.toString() });
  client = await pool.connect();
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
  );
  for (const entry of journal.entries.filter((e) => e.idx < 31)) {
    await client.query("BEGIN");
    try {
      await client.query(fs.readFileSync(path.join(root, "drizzle", entry.tag + ".sql"), "utf8"));
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  const db = drizzle(pool, { schema });
  for (const id of ["A_legacy", "z_legacy", "new-a", "new-b", "new-c"]) {
    await db.insert(schema.user).values({
      id,
      name: id,
      email: `${id}@example.test`,
      username: id.toLowerCase().replaceAll("-", "_"),
      ageAttested: true,
    });
    await db.insert(schema.profile).values({ userId: id, displayName: id });
  }
  await db.insert(schema.follow).values([
    { followerId: "A_legacy", followingId: "z_legacy" },
    { followerId: "z_legacy", followingId: "A_legacy" },
    { followerId: "new-a", followingId: "new-b" },
  ]);
  const before = (await client.query('SELECT * FROM "follow" ORDER BY follower_id, following_id'))
    .rows;
  await client.query("BEGIN");
  await client.query(fs.readFileSync(path.join(root, "drizzle/0031_friend_requests.sql"), "utf8"));
  await client.query("COMMIT");
  assert.deepEqual(
    (await client.query('SELECT * FROM "follow" ORDER BY follower_id, following_id')).rows,
    before,
  );
  let requested = 0,
    accepted = 0;
  const push = {
    newFollower() {},
    friendRequest() {
      requested++;
    },
    friendAccepted() {
      accepted++;
    },
  };
  const follows = new FollowsService(db, push);
  const friends = new FriendshipsService(db, follows, push, { presignDownload: async () => "" });
  assert.equal(await follows.areFriends("A_legacy", "z_legacy"), true);
  assert.equal(await follows.areFriends("new-a", "new-b"), false);
  await follows.follow("new-b", "new_a");
  assert.equal(
    await follows.areFriends("new-a", "new-b"),
    false,
    "new mutual follows must not create friends",
  );
  const followSnapshot = (
    await client.query('SELECT * FROM "follow" ORDER BY follower_id, following_id')
  ).rows;
  const privatePost = (
    await db
      .insert(schema.post)
      .values({ authorId: "new-a", body: "private", visibility: "friends" })
      .returning()
  )[0];
  const privateVisible = async () =>
    (
      await db
        .select()
        .from(schema.post)
        .where(
          visibleTo(
            "new-b",
            alias(schema.follow, "viewer_follows_author"),
            alias(schema.follow, "author_follows_viewer"),
          ),
        )
    ).some((p) => p.id === privatePost.id);
  assert.equal(await privateVisible(), false);
  const repeats = await Promise.all(
    Array.from({ length: 12 }, () => friends.request("new-a", "new_b")),
  );
  assert(repeats.every((x) => x.friendship === "outgoing"));
  assert.equal(requested, 1);
  assert.equal(
    (await friends.request("new-b", "new_a")).friendship,
    "incoming",
    "crossed requests are not acceptance",
  );
  await assert.rejects(() => friends.accept("new-a", "new_b"));
  assert.equal(await privateVisible(), false);
  await Promise.all(Array.from({ length: 8 }, () => friends.accept("new-b", "new_a")));
  assert.equal(accepted, 1);
  assert.equal(await follows.areFriends("new-a", "new-b"), true);
  assert.equal(await privateVisible(), true);
  assert.equal(
    (await friends.dismiss("new-a", "new_b")).friendship,
    "friends",
    "late cancel cannot remove accepted friend",
  );
  assert.equal((await friends.remove("new-a", "new_b")).friendship, "none");
  assert.equal(await privateVisible(), false);
  assert.deepEqual(
    (await client.query('SELECT * FROM "follow" ORDER BY follower_id, following_id')).rows,
    followSnapshot,
  );
  assert.equal((await friends.requests("new-b", "incoming")).items.length, 0);
  await friends.request("new-a", "new_c");
  assert.equal((await friends.requests("new-c", "incoming")).items.length, 1);
  await friends.dismiss("new-c", "new_a");
  assert.equal((await friends.requests("new-c", "incoming")).items.length, 0);
  await db.insert(schema.memberBlock).values({ blockerId: "new-c", blockedId: "new-a" });
  await assert.rejects(() => friends.request("new-a", "new_c"));
  await assert.rejects(() => friends.request("new-a", "new_a"));
  console.log(
    "PASS: migration preserves legacy friends and every follow; new mutual follows are not friends; duplicate/crossed requests, recipient-only acceptance, private post visibility, decline/cancel/removal and blocks verified.",
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (client) client.release();
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });
