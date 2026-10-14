# Matching v1

How "Kinksters Near You" on the home feed picks and orders members. The rules
live in one pure module, `apps/api/src/members/matching.ts` (unit-tested in
`matching.spec.ts`), so the feed algorithm can start from the same rules.
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
