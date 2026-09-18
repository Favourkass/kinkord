# People Tab — Name, Age, Gender & Location

Adds age, gender, and location to each row in the profile People tab, and removes the `@handle` line. Applies to all four sub-tabs (Friends, Followers, Following, Suggested).

---

## Table of contents

- [Overview](#overview)
- [Expected behavior](#expected-behavior)
  - [Row layout](#row-layout)
  - [Formatting rules](#formatting-rules)
  - [Edge cases](#edge-cases)
  - [Sub-tabs](#sub-tabs)
- [What is not changing](#what-is-not-changing)
- [Data flow](#data-flow)
- [Files](#files)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Untouched](#untouched)
- [Implementation details](#implementation-details)
  - [Why age is derived, not stored](#why-age-is-derived-not-stored)
  - [Why the handle field stays](#why-the-handle-field-stays)
  - [Query cost](#query-cost)
- [Testing checklist](#testing-checklist)
- [Rollout](#rollout)
- [Out of scope](#out-of-scope)
- [Future work](#future-work)

---

## Overview

Before this change, a People row showed:

```
Sudom
@smartlead
```

After:

```
Sudom
25F · Abraka, Delta State
```

The `@handle` was removed from the People tab. It is still present on the **Suggested Friends** right-column card on desktop, since that is a separate surface. The change is additive at the API level — no new endpoints, no schema migration, no new query parameters.

The new fields are the same ones the directory cards already show (`age`, `gender`, `city`, `state`), formatted with the same helpers, so the two surfaces stay visually consistent without inventing a new format.

---

## Expected behavior

### Row layout

A row is unchanged in structure: a 48px circular avatar on the left, the Follow button / Friends pill and a "more" icon on the right. Only the two-line text block between them changes.

| Line | Before | After |
|---|---|---|
| 1 | `DisplayName` (13px bold) | `DisplayName` (13px bold) — unchanged |
| 2 | `@handle` (11px muted) | `25F · Abraka, Delta State` (11px muted) |

The row's height, avatar size, spacing, tap target, and the position of the Follow button are all identical to before. No layout shift on any viewport.

### Formatting rules

Both derived fields mirror the directory card (`toMemberCardVM`) exactly:

**Age tag** — `age` + gender initial, concatenated with no separator:

| API values | Rendered |
|---|---|
| `age: 25`, `gender: "Female"` | `25F` |
| `age: 25`, `gender: "Male"` | `25M` |
| `age: 25`, `gender: null` | `25` |
| `age: null`, `gender: "Female"` | `F` |
| `age: null`, `gender: null` | (omitted) |

The `age === null ? null : \`${age}${genderInitial(gender)}\`` expression matches `toMemberCardVM` line-for-line, including the case where age is null but gender is set (yields just the initial). This is intentional — the two surfaces should never disagree about how the same member is labeled.

**Location** — `[city, displayState(state)].filter(Boolean).join(", ")`:

| API values | Rendered |
|---|---|
| `city: "Abraka"`, `state: "Delta"` | `Abraka, Delta State` |
| `city: null`, `state: "Delta"` | `Delta State` |
| `city: "Abraka"`, `state: null` | `Abraka` |
| both null | (omitted) |

`displayState` appends `" State"` unless the value already ends in it or begins with `FCT`. Country is **not** included — the directory cards drop it too, and adding it would make every Nigerian row read `…, Nigeria` redundantly.

**Line 2 as a whole** — the two parts are joined with `" · "` and the line is omitted entirely when both are empty:

```
[ageTag, location].filter(Boolean).join(" · ")
```

| ageTag | location | Line 2 |
|---|---|---|
| `25F` | `Abraka, Delta State` | `25F · Abraka, Delta State` |
| `25F` | (none) | `25F` |
| (none) | `Abraka, Delta State` | `Abraka, Delta State` |
| (none) | (none) | *(no line 2 — row stays 48px)* |

### Edge cases

| Case | Behavior |
|---|---|
| Member with no DOB on file | `age` is `null`; line 2 falls back to whatever gender / location are available |
| Member with no gender on file | Age renders without an initial (`25`), not `25?` or `25·` |
| Member with no city but a state | `Delta State` |
| Member with neither city nor state | No line 2; the row keeps its 48px height, no blank gap |
| Very long city name | Line 2 truncates with ellipsis, same as the old `@handle` line did |
| Deleted / unset avatar | Placeholder icon renders as before; new text lines still show |
| Busy (follow in-flight) | Follow button shows `disabled:opacity-60`; text lines unaffected |

### Sub-tabs

All four People sub-tabs go through the same `toRow` function, so the new fields appear in every one:

- **Friends** — mutual follows
- **Followers** — people who follow the profile owner
- **Following** — people the profile owner follows
- **Suggested** — kinksters in the same state, own area first

The **Suggested Friends** right-column card on desktop also receives the new fields in its VM (same `toRow`), but its component (`SuggestedFriends.tsx`) is unchanged and still renders the handle. That is deliberate — a small 36px card in a sidebar has no room for a three-part meta line.

---

## What is not changing

- **Route and query params.** `GET /profiles/:username/friends?tab=…&page=…&limit=…` is unchanged.
- **Pagination.** Same `{ items, total, page, limit }` envelope.
- **The `isFollowing` field and the Follow button** — untouched.
- **The "Friends" pill** on your own Friends list — untouched.
- **Avatar URLs** — still presigned at `"sm"` (48px rows), never the full-resolution original.
- **`publicProfile` / `media` / `list` endpoints** — the directory and the profile hero already show these fields; nothing there is edited.
- **`people` copy in `constants/members.ts`** — no new strings are needed; the meta line is data, not copy.
- **DB schema** — no migration.

---

## Data flow

```
GET /profiles/:username/friends?tab=…
  → PublicProfilesController.friends()                    [unchanged]
  → MembersService.friends(username, viewerId, tab, …)    [projection widened]
      → FollowsService.friends / followers / following / mutualFriends
                                            [4 selects widened]
      → MembersService.suggested()          [select widened]
  → presign avatarKey
  → { userId, username, displayName, avatarUrl,
      age, gender, city, state, isFollowing }             [new fields]
  → friendApi → FriendPM                                  [type widened]
  → toRow() → FriendRowVM                                 [derives ageTag, location]
  → PeopleTab.tsx                                         [renders line 2]
```

Every underlying query already `innerJoin(profile, …)`, so `dateOfBirth`, `gender`, `city`, and `state` were one `select()` add away in each. No join was added.

`dateOfBirth` is selected but **never leaves the API** — the service converts it to `age` via `ageFromDob` before returning, matching the rule already enforced in `MembersService.list()` and `MembersService.publicProfile()`.

---

## Files

### Backend

**`follows.service.ts`**

- `FriendRow` interface gains `dateOfBirth: string | null`, `gender: string | null`, `city: string | null`, `state: string | null`.
- `friends`, `followers`, `following`, `mutualFriends` each add the four columns to their `select({...})`. No change to `where`, `orderBy`, `limit`, `offset`, or the `count()` companion query.

**`members.service.ts`**

- `suggested()` adds the same four columns to its `select({...})`.
- `friends()` adds `age: ageFromDob(r.dateOfBirth)`, `gender`, `city`, `state` to each item in the response map. `ageFromDob` is defined in this same file — no new import.

**`public-profiles.controller.ts`** — unchanged. It forwards `{ tab, page, limit }` to `members.friends` and returns whatever the service hands back.

### Frontend

**`services/members.service.ts`**

- `FriendPM` gains `age: number | null`, `gender: string | null`, `city: string | null`, `state: string | null`.

**`domain/member.ts`**

- `FriendRowVM` gains `ageTag: string | null` and `location: string | null`.
- `handle: string | null` is retained — `SuggestedFriends.tsx` still uses it.

**`presenters/useMemberProfilePresenter.ts`**

- Imports `genderInitial` and `displayState` from `util/format`.
- `toRow` builds `ageTag` and `location` from the new `FriendPM` fields.

**`components/profile/PeopleTab.tsx`**

- The middle text block of the row swaps the `@handle` line for the age/location line.

### Untouched

```
components/profile/SuggestedFriends.tsx
components/profile/ProfileScreen.tsx
components/profile/ProfileShell.tsx
components/profile/ProfileHero.tsx
components/profile/ProfileSideCard.tsx
app/profile/page.tsx
app/u/[username]/page.tsx
constants/members.ts
util/format.ts
```

No new dependencies. No CSS changes. No new design tokens.

---

## Implementation details

### Why age is derived, not stored

The product rule is that a member's birth date never leaves the server. `MembersService.list()` already enforces this: it selects `dateOfBirth` from the row, computes `ageFromDob(r.dateOfBirth)` in the mapper, and returns `age` — never the DOB. `MembersService.publicProfile()` does the same, with a carve-out that only your own profile receives `dateOfBirth`.

This change follows the same rule. `dateOfBirth` is selected inside `FollowsService` (which is server-only), handed to `MembersService.friends()`, and immediately converted to `age` before the response is serialized. A member calling the friends endpoint cannot see another member's DOB in the JSON.

`ageFromDob` is calendar-correct (it checks whether the birthday has passed this year) and returns `null` for missing or unparseable dates, so a member who never set a DOB shows a row without an age rather than a bogus `0` or `NaN`.

### Why the handle field stays

`FriendRowVM` is shared by two components:

- `PeopleTab` — the tab this change targets
- `SuggestedFriends` — the right-column card on desktop, which still shows the handle

Dropping `handle` from the VM would force `SuggestedFriends.tsx` to change too, which is out of scope. Keeping `handle: string | null` on the VM and simply not rendering it in `PeopleTab` is the minimal change. If the design ever asks for the handle to come back to the People tab, it is a one-line revert in the component.

The alternative — splitting into `PeopleRowVM` (no handle) and `SuggestedRowVM` (handle) — is more type-safe but adds a second mapping in the presenter and two nearly-identical types. Not worth it for a field that is one line of JSX.

### Query cost

Each friends query already joined `profile` to reach `displayName`, `avatarKey`, and the `isFollowing` subquery. The four new columns come from the row that was already on the join, so:

- **No new joins.**
- **No new indexes needed** — none of the new columns are filtered or sorted on.
- **One extra column read** per row: `dateOfBirth` (a `date` column, 4 bytes). `gender`, `city`, and `state` are small `varchar`s.
- **The `count()` query is unchanged** — it does not project row columns, only `count()`.

The response payload grows by roughly 60–80 bytes per row (`age` is a number; `gender`, `city`, `state` are short strings, all nullable). The `limit` is capped at 50 by `normalizePaging`, so the worst-case response grows by ~4 KB. The list endpoint already returns more per item (`roles`, `followersCount`, `lastSeenAt`, etc.).

No caching layer is affected — none of these endpoints is cached at the HTTP level; responses are per-viewer because of `isFollowing`.

---

## Testing checklist

### Backend

- [ ] `follows.service.spec.ts` — `friends`, `followers`, `following`, `mutualFriends` each return the four new fields in `items[0]`.
- [ ] `members.service.spec.ts` — `friends()` maps `dateOfBirth` → `age` and passes `gender` / `city` / `state` through unchanged.
- [ ] `members.service.spec.ts` — `friends()` returns `age: null` when the source `dateOfBirth` is null.
- [ ] `members.service.spec.ts` — `suggested()` includes the four new fields on each item.
- [ ] Confirm `dateOfBirth` **never** appears in any `friends` response body.
- [ ] All four tabs (`all`, `followers`, `following`, `suggested`) exercised end-to-end.

### Frontend

- [ ] `useMemberProfilePresenter.spec.ts` (if present) — `toRow` builds `ageTag` as `"25F"` from `{ age: 25, gender: "Female" }`.
- [ ] `toRow` builds `location` as `"Abraka, Delta State"` from `{ city: "Abraka", state: "Delta" }`.
- [ ] `toRow` yields `ageTag: null` when `age` is null.
- [ ] `toRow` yields `location: null` when both `city` and `state` are null.
- [ ] `PeopleTab` renders the combined meta line when both fields are present.
- [ ] `PeopleTab` renders `25F` alone when location is null.
- [ ] `PeopleTab` renders `Abraka, Delta State` alone when age is null.
- [ ] `PeopleTab` renders no line 2 when both are null (no empty `<span>`).
- [ ] `PeopleTab` no longer renders `@handle` anywhere.
- [ ] `SuggestedFriends` still renders `@handle` on desktop.

### Manual

- [ ] Mobile: open `/profile` → People → verify all four sub-tabs show the meta line.
- [ ] Desktop: same check on the wider layout; confirm the right-column "Suggested Friends" card still shows the handle.
- [ ] Open a member with no DOB, no city, and no state — verify no empty line.
- [ ] Toggle Follow on a row — verify the button state flips without the text lines flickering.
- [ ] Rotate / resize — verify no truncation glitch or overflow on long city names.
- [ ] Confirm the API response in devtools contains `age`, `gender`, `city`, `state` but **not** `dateOfBirth`.

---

## Rollout

The two changes are independent in the sense that neither breaks the other:

- **Backend first** (safe): adding fields to a response is backward-compatible. The old frontend ignores the new fields. No client change is required to deploy this.
- **Frontend second**: once the API returns the new fields, the frontend picks them up on the next deploy. Until then, `ageTag` and `location` are `null` and line 2 renders without them, so the row degrades gracefully (name only) rather than breaking.

There is no feature flag, no migration, and no coordinated release window needed. If the API is rolled back after the frontend ships, the rows simply fall back to showing only the name until the API is forward again.

---
