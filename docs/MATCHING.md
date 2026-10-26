# Matching v1

How "Kinksters Near You" on the home feed picks and orders members. The rules
live in two pure modules, `apps/api/src/members/matching.ts` (unit-tested in
`matching.spec.ts`) and, for who the viewer knows,
`people-you-may-know.ts` (`people-you-may-know.spec.ts`). The home feed's
For You ranks by matching's kink parts (see [Feed](#feed)).
`MembersService.suggestedForFeed` gathers the pool and returns the cards.

## Who is shown

The viewer's own profile decides, never anyone else's. Sexuality is private:
other members' sexuality is not read, ranked on, or returned.

`GET /members/suggested?show=women|men|all`. Without `show`, the default is
**sexuality if the member has given it, otherwise gender**:

| Viewer                                  | Default | Segments offered |
| --------------------------------------- | ------- | ---------------- |
| Man: straight, or no sexuality given    | women   | Women, Men       |
| Woman: straight, or no sexuality given  | men     | Women, Men       |
| Bisexual, any gender                    | all     | All, Women, Men  |
| Gender unknown, whatever the sexuality  | all     | All, Women, Men  |

A sexuality added to `ORIENTATIONS` later needs one line in
`SHOWN_BY_SEXUALITY` (e.g. `Gay: sameGender`). A `show` outside the segments
offered falls back to the default. The response carries the effective `show`
and the `options`, so the web selects the right segment. "All" mixes both
genders with no gender ordering. Genders are compared case-insensitively
(sign-up stored `male`/`female`, Edit Profile `Male`/`Female`).

## The pool

Members in the viewer's country (their state if they have no country), of the
gender shown, excluding: the viewer, suspended members, anyone on either side
of a block, anyone the viewer follows, anyone they're friends with or have a
friend request with (either way), and anyone they removed
(`suggestion_dismissal`, via `POST /members/suggested/:userId/dismiss`).
Location and directory privacy apply as before. From them:

- the same state first, then most recently seen, up to 300;
- the members the viewer **knows of**: friends of their friends, who follows
  them, who the members they follow follow, who liked or commented on their
  posts in the last 60 days, and whose posts they liked or commented on, up
  to 200 from each;
- the **newest** 60, who joined in the last 7 days.

Scored in TypeScript; the best `limit` (default 10, max 20) are returned.

## The score

Kink roles fall on a side. **Dom:** Dominant, Domme, Master, Mistress, Owner,
Sadist, Top, Brat Tamer, Handler, Rigger, Caregiver, Affini. **Sub:**
Submissive, Slave, Bottom, Pet, Masochist, Brat, Little, Rope Bunny, Adult
Baby, ABDL, Acolyte, Affection Slut, Cuckold. **Switch** is its own; anything
else is neutral. Dom-only viewers want subs, sub-only viewers want doms; a
Switch (or someone on both sides) wants either; no side means no preference.

| Part                                   | Points                       |
| -------------------------------------- | ---------------------------- |
| Candidate on the wanted side           | +4                           |
| Else candidate is a Switch             | +2                           |
| Else candidate only on the viewer's side (dom shown dom) | −2         |
| Each role pair completed (either way)  | +2, up to +4                 |
| Each shared kink (`interests`)         | +1, up to +5                 |
| Each shared looking-for                | +1, up to +3                 |
| Same city (and state), else same state | +4, else +3                  |
| Online now, else seen in the last 7 days | +2, else +1                |
| Has a profile photo                    | +2                           |

**Who the viewer knows** adds to that (people you may know, the founder's
plan of 2026-10-26):

| Part                                                        | Points            |
| ----------------------------------------------------------- | ----------------- |
| Each accepted friend the two have in common                 | +3, up to +12     |
| Follows the viewer (who doesn't follow them)                | +6                |
| Each member the viewer follows who follows them             | +1, up to +3      |
| Liked or commented on the viewer's posts in the last 60 days | +2               |
| The viewer liked or commented on theirs                     | +2                |
| Joined in the last 7 days                                   | +4                |

**Exposure:** a member suggested more than 40 times in the last 6 hours has
their score multiplied by 40 / that many times (80 times: × 0.5), so the same
few faces don't fill every strip. It's counted in memory on each API instance
and starts afresh on a deploy: approximate on purpose. A score below 0 isn't
scaled. There is no Silver boost.

Pairs: Dominant/Domme–Submissive, Master/Mistress–Slave, Top–Bottom,
Sadist–Masochist, Owner/Handler–Pet, Brat Tamer–Brat, Rigger–Rope Bunny,
Caregiver–Little/Adult Baby/ABDL, Exhibitionist–Voyeur.

Ties: most recently seen, then newest account, then user id.

## The card

Name, Silver check, **why they're suggested**, age and gender initial, city ·
state · country, the first three roles (those on the wanted side first), the
first three looking-for values, Online, Follow/Following and Remove.

The reason is the first of these that applies, and only what the viewer may
know (`reason` in the API, worded by the app):

1. "3 mutual friends": only when the member lets the viewer see their
   followers and following, as the count on their profile does;
2. "Follows you";
3. "Likes your posts", else "Comments on your posts";
4. "New to Kinkord", in their first 7 days;
5. "2 kinks in common" or more, among the kinks the viewer can read.

What the viewer did themselves (liking their posts, following who follows
them) is never given as a reason. Otherwise the card says nothing.

## Feed

The home feed has three tabs: **For You** (the default), **Following** and
**Nearby**. The rules live in `apps/api/src/posts/feed-ranking.ts` (pure,
unit-tested in `feed-ranking.spec.ts`); `feed-tabs.ts` reads the database for
them and `PostsService.feed` decorates the page.

`GET /posts/feed?tab=for_you|following|nearby&cursor=…&limit=…` (limit 1–30,
default 10). Without `tab` the feed is every visible post, newest first,
exactly as before the tabs, so the web that predates them keeps working while
the API ships first. A profile's Posts tab (`author`) and search (`q`) read
newest first and ignore `tab`. A tab that may be empty says why in `hint`:
`no_follows` or `no_location`.

Every tab:

- reads through the one visibility rule (`posts/visibility.ts`): public posts,
  the viewer's own, friends-only posts between mutual follows, never a
  suspended author;
- leaves out anyone on either side of a block: the row's author, and the
  author of the post a repost shows;
- shows a repost only while its original is live and public, by someone not
  suspended or blocked either way.

### Following

Newest first: posts and reposts by members the viewer follows, plus their own,
whatever country anyone is in (a member in Nigeria following one in Kenya sees
their posts). The timestamp cursor, as before. Empty for a viewer who follows
nobody: `hint: "no_follows"`, and the app invites them to browse members.

### For You

Candidates come from several pools, each newest first and capped, so no one
pool (and no busy hour) crowds the rest out as the community grows. All made
at or before `asOf` (below), never the viewer's own posts (they are in
Following) nor a repost of one. The founder set these on 2026-10-26.

| Pool | Posts and reposts | Newest |
| --- | --- | --- |
| Recent | everyone's, the last 7 days | 300 |
| Followed | by members the viewer followed at `asOf`, the last 30 days | 400 |
| Friends | by their accepted friends, followed or not, the last 30 days | 200 |
| Interacted | by the 50 authors with the highest affinity A (below), the last 30 days | 200 |
| Near | original posts by members in their state (within their country), the last 14 days, as Nearby reads them | 200 |
| Trending | the posts with the most likes + 2 × comments in the last 3 days, by members in their country (anyone's, without one) | 200 |
| Newcomers | by members who joined in the last 7 days, in their country | 60 |

The near, trending and newcomer pools only count an author's place when their
location is readable to the viewer. Near needs the viewer's state; newcomers
need their country.

What's trending is the same for every viewer, so it is read once every 5
minutes (as of the start of those 5 minutes) and shared, by country; each
viewer's trending pool then goes through the visibility rule like the rest.

**score = relevance × 0.5^(age in hours / 36) × 0.35 if the viewer already
liked, commented on, saved or reposted it.** The age is the row's: a repost is
new when it is made. relevance = 1 plus:

| Part | Points |
| --- | --- |
| The viewer follows whoever put the row in the feed (its author, or who reposted it) | +6, and +2 more when they follow back |
| They are friends with whoever put the row in the feed | +8, as a follow both ways, followed or not |
| Affinity: A = the viewer's likes (1), saves (2), shares (2), comments (3) and reposts (3) of the card author's posts in the last 60 days, capped at 30 | 2.5 × ln(1 + A) |
| Kink match: matching v1's kink parts (role side, pairs, shared kinks, shared looking-for; not place, presence or photo) | 0.4 × their sum, never below 0 |
| The card author's gender is the one the viewer is shown by default (the same rule as the strip) | +3, none for "All" |
| Learned kinks ("things I like"): the viewer's top 5 kinks among the authors they interacted with in 60 days, each author's kinks weighted by A | +0.5 per one the card author has, up to +2.5 |
| Engagement velocity: likes + 2 × comments + 3 × reposts + 2 × shares, divided by 1 + (the post's age in hours / 6) | 1.2 × ln(1 + that) |
| Newcomer: the card author joined in the last 7 days | +2 |
| Place: the same city (and state), else the same state, else the same country | +2, else +1.5, else +1 |

The card author is the original's author for a repost: affinity, kink match,
gender, learned kinks, engagement, place and newcomer are all about the post
the card shows (velocity is by the original's age). States and cities only
match within one country.

Velocity means a post taking off now beats one that gathered its likes days
ago: 10 reactions in the last 6 hours count 5; 30 over two days count about 3.

Then: **one row per post** (when an original and its reposts are all
candidates, only the best-scoring row stays), ties to the newer row and then
the larger id, and **never more than 2 rows in a row from one member** (the
row's author, so a run of one member's reposts is broken up too): a greedy,
deterministic reorder of the whole list before it is paged.

**A newcomer near the viewer gets seen**: the best-ranked post by a member in
their first 7 days, from the viewer's city or state (else their country), is
moved up to the 4th card when it ranked lower, and the 2-in-a-row rule is
applied again after the move.

Privacy: only the viewer's own sexuality is read. An author's kinks and
looking-for count, in the kink match and in learned kinks, only when their
profile is public or the two follow each other (as on the profile and the
strip); roles always count, being on every card.

### Nearby

Original posts (not reposts) by members in the viewer's state (within their
country, when they have one), from the last 14 days, the newest 800, made at
or before `asOf`, never the viewer's own. No gender filter. Without a state:
empty, with `hint: "no_location"`, and the app links to Edit Profile →
Location. (The founder narrowed Nearby from the country to the state on
2026-10-14.)

**score = closeness × 0.5^(age in hours / 24) × (1 + 0.15 × ln(1 + engagement))**,
closeness being 2 for the viewer's own city and 1 for the rest of the state,
and engagement counted as for For You. The same one-row-per-post and diversity
rules.

### Paging For You and Nearby

The first page ranks as of now, `asOf`; its cursor carries that moment, and
every later page ranks the same list as of it: candidates, follows,
interactions and counts are read as they stood at `asOf`, so a like, a follow
from a card or a new post mid-scroll can't reshuffle the next page. The next
first page ranks afresh.

The ranked list (ids only) is kept in memory on the API instance for 10
minutes, 200 lists at most, so later pages don't rank it again. An instance
that doesn't have it (another instance, or later) ranks it again as of the
same `asOf` and gets the same list.

The cursor is opaque base64url JSON, versioned: `{ v: 1, tab, asOf, at:
"ranked", offset }` inside the ranked list (offset up to 1,560, every pool
full). When the list runs out, the page fills with older posts, newest first,
and the cursor carries on as `{ at: "older", before }`, so the feed never ends
early: for For You, everything older than the recent pool, less every row the
ranked list had (its other pools reach further back; read from the remembered
list, or by ranking it again); for Nearby, the state's older posts. A cursor
from before the pools, with a `skip`, still reads. A cursor that isn't this
tab's (garbage, another version, another tab) reads the first page.

Known limits: an unlike, an unfollow, a deleted post or a new block between
pages can still move a post across a page boundary (they delete rows, so they
can't be read as of `asOf`); the app drops a row it already shows.

### Not yet

- Impressions: For You knows what the viewer reacted to, not what they
  scrolled past, so a post seen and ignored isn't lowered yet.
- Negative feedback: "show me less of this", hiding a post, muting a member.
- Nearby by distance rather than the same city or state.
- Tuning the pools and weights against real use.
