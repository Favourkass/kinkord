# Kink Rings

A Kink Ring is a month of Silver a member can give to someone else. The
founders set the rules on 2026-10-27.

## Getting rings

- **Silver for a month** brings **1** ring.
- **Silver for a year** brings **12**.
- Each ring expires a month of Silver after the payment is confirmed, so a
  year's twelve run out a month apart. The Nth ring expires **30 × N days**
  after confirmation: 30 days for the first, 60 for the second, and on to 360
  for the twelfth.
- Rings are made when an admin confirms the payment, in the same transaction
  that turns Silver on, so they come exactly once per payment
  (`kink_ring_payment_seq_idx`). A payment confirmed while the founders' Silver
  is running still brings its rings.
- A ring not given by its expiry is gone.

The founders each got three rings to try giving when this shipped (migration
0046): 30, 60 and 90 days. They went to their main accounts only.

## Giving one

From **Kink Rings** in the account menu (`/kink-rings`): find a member by name
or @username, pick them, confirm.

- The giver's **soonest-to-expire** ring is used. It's locked while it's given
  (`FOR UPDATE SKIP LOCKED`), so two gifts at once never spend the same ring.
- The receiver gets **a month of Silver**, by the same rule as a member's own
  payment (`addSilverTime`, `subscriptions/silver-time.ts`):
  - it runs on from where their Silver ends, or from now when it has run out;
  - while Silver the founders gave them is running, the month goes to their own
    time (`paidUntil`), theirs if the gift is ever taken back.
  - A Silver check held after a name or photo change stays held. Unlike an
    admin confirming a payment, a ring from another member vouches for nothing.
- The receiver is told: "Ada gave you a Kink Ring: a month of Silver". The push
  goes at once, is held through quiet hours, and has no switch, like account
  notices. Tapping it opens the giver's profile.
- The giver sees the rings they have left, each with its expiry date (Lagos
  time), and the last 20 they gave and to whom.

Never to:
- **themselves**, since rings are for giving;
- **an organization**;
- **a suspended member**, or anyone on **either side of a block** (the API
  answers "no such member");
- someone whose Silver already runs **for good** (the founders, and admins the
  founders gave Silver), where a ring would add nothing.

## API

| Route | |
| --- | --- |
| `GET /kink-rings` | `{ available: [{ id, expiresAt }], given: [{ id, givenAt, to }] }` |
| `POST /kink-rings/give` `{ username }` | `{ ringId, to: { username, displayName }, left }`. 404 when there's no such member, 400 for the refusals above, 409 with no ring left. |

## Data

`kink_ring` (migration 0046):
- `owner_id`
- `payment_id` (null for the founders' rings)
- `seq` (1 to 12)
- `expires_at`
- `given_to`, `given_at`

A ring is **available** while `given_at` is null and `expires_at` is ahead.
Rings go with their owner's account. The giver's record stays if the receiver
leaves.

## Not yet

- A "Give a Kink Ring" button on members' profiles.
- Mentioning rings on the Silver plans screen.
- Telling a member when one of their rings is about to expire.
