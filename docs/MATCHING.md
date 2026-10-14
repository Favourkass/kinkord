# Matching v1

How "Kinksters Near You" on the home feed picks and orders members. The rules
live in one pure module, `apps/api/src/members/matching.ts` (unit-tested in
`matching.spec.ts`), and the home feed's For You ranks by their kink parts
(see [Feed](#feed)). `MembersService.suggestedForFeed` gathers the pool and
returns the cards.

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
of a block, anyone the viewer follows, and anyone they removed
(`suggestion_dismissal`, via `POST /members/suggested/:userId/dismiss`). The
same state first, then most recently seen, up to 300; scored in TypeScript;
the best `limit` (default 10, max 20) are returned.

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

Pairs: Dominant/Domme–Submissive, Master/Mistress–Slave, Top–Bottom,
Sadist–Masochist, Owner/Handler–Pet, Brat Tamer–Brat, Rigger–Rope Bunny,
Caregiver–Little/Adult Baby/ABDL, Exhibitionist–Voyeur.

Ties: most recently seen, then newest account, then user id.

## The card

Name, Silver check, age and gender initial, city · state · country, the first
three roles (those on the wanted side first), the first three looking-for
values, Online, Follow/Following and Remove.

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

Candidates, all made at or before `asOf` (below), never the viewer's own posts
(they are in Following) nor a repost of one:

- every visible post and repost of the last 7 days, the newest 600, and
- the posts and reposts of members the viewer followed at `asOf`, from the
  last 30 days, the newest 400.

**score = relevance × 0.5^(age in hours / 36) × 0.35 if the viewer already
liked, commented on, saved or reposted it.** The age is the row's: a repost is
new when it is made. relevance = 1 plus:

| Part | Points |
| --- | --- |
| The viewer follows whoever put the row in the feed (its author, or who reposted it) | +6, and +2 more when they follow back |
| Affinity: A = the viewer's likes (1), saves (2), shares (2), comments (3) and reposts (3) of the card author's posts in the last 60 days, capped at 30 | 2.5 × ln(1 + A) |
| Kink match: matching v1's kink parts (role side, pairs, shared kinks, shared looking-for; not place, presence or photo) | 0.4 × their sum, never below 0 |
| The card author's gender is the one the viewer is shown by default (the same rule as the strip) | +3, none for "All" |
| Learned kinks ("things I like"): the viewer's top 5 kinks among the authors they interacted with in 60 days, each author's kinks weighted by A | +0.5 per one the card author has, up to +2.5 |
| Engagement: likes + 2 × comments + 3 × reposts + 2 × shares | 1.2 × ln(1 + that) |
| Place: the same city (and state), else the same state, else the same country | +2, else +1.5, else +1 |

The card author is the original's author for a repost: affinity, kink match,
gender, learned kinks, engagement and place are all about the post the card
shows. States and cities only match within one country.

Then: **one row per post** (when an original and its reposts are all
candidates, only the best-scoring row stays), ties to the newer row and then
the larger id, and **never more than 2 rows in a row from one member** (the
row's author, so a run of one member's reposts is broken up too): a greedy,
deterministic reorder of the whole list before it is paged.

Privacy: only the viewer's own sexuality is read. An author's kinks and
looking-for count, in the kink match and in learned kinks, only when their
profile is public or the two follow each other (as on the profile and the
strip); roles always count, being on every card.

### Nearby

Original posts (not reposts) by members in the viewer's country, or their
state when they have no country, from the last 14 days, the newest 800, made
at or before `asOf`, never the viewer's own. No gender filter. With neither a
country nor a state: empty, with `hint: "no_location"`, and the app links to
Edit Profile → Location.

**score = closeness × 0.5^(age in hours / 24) × (1 + 0.15 × ln(1 + engagement))**,
closeness being the same city 4, the same state 2, the same country 1, and
engagement counted as for For You. The same one-row-per-post and diversity
rules.

### Paging For You and Nearby

The first page ranks as of now, `asOf`; its cursor carries that moment, and
every later page ranks the same list as of it: candidates, follows,
interactions and counts are read as they stood at `asOf`, so a like, a follow
from a card or a new post mid-scroll can't reshuffle the next page. The next
first page ranks afresh.

The cursor is opaque base64url JSON, versioned: `{ v: 1, tab, asOf, at:
"ranked", offset }` inside the ranked list. When the list runs out, the page
fills with older posts, newest first, and the cursor carries on as `{ at:
"older", before, skip }`, so the feed never ends early: for For You, everything
older than the week's pool, less the followed members' posts already ranked;
for Nearby, the country's older posts. A cursor that isn't this tab's (garbage,
another version, another tab) reads the first page.

Known limits: an unlike, an unfollow, a deleted post or a new block between
pages can still move a post across a page boundary (they delete rows, so they
can't be read as of `asOf`); the app drops a row it already shows.

### Not yet

- Impressions: For You knows what the viewer reacted to, not what they
  scrolled past, so a post seen and ignored isn't lowered yet.
- Negative feedback: "show me less of this", hiding a post, muting a member.
- Keeping a ranked window between pages instead of reading it again per page.
- Nearby by distance rather than the same city, state or country.
- Widening the pools (600 recent, 400 followed, 800 nearby) once the
  community outgrows them, and tuning the weights against real use.
