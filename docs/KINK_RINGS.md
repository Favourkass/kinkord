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

## Giving rings

From **Kink Rings** in the account menu (`/kink-rings`):

1. The overview shows the available balance and recent gifting history.
2. Tap the balance to view inventory: abbreviated ring IDs (copy or open details
   for the full UUID), purchase/award dates, expiry dates and days remaining.
3. Gift an individual ring or select multiple rings (up to 50 per submission).
   The overview's Gift button offers the soonest-expiring 50 available rings.
4. Choose recipients from accepted Friends or Search. Search honors search
   visibility; avatars, location and online status honor profile privacy.
5. Review Selected Recipients, then continue to Ring Allocation. Each starts
   with one ring and can receive more within the selected balance. Choose exact
   IDs using each ring's dropdown; choosing an already assigned ring swaps the
   two slots. Unassigned rings stay in inventory.
6. Add an optional personal message (up to 500 characters) for each recipient.
   A note is a message, so it follows "Who Can Send Me a Message", both ways, as
   chat does. A recipient whose setting leaves the giver out gets the ring with
   no note: the screen says so instead of offering the box, and the API refuses
   a note to them (403).
7. Review & Confirm shows the exact recipient, ring IDs and message. Edit
   Recipients preserves existing allocations and messages. Only the final Send
   button submits the gifts, together in one transaction.

**Buy Kink Ring opens the existing Silver Premium purchase page** (`/subscription`).
There is no separate ring purchase or price.

- Selected rings are ownership-checked and locked in UUID order (`FOR UPDATE`).
  One unavailable, expired or invalid gift rejects the entire batch. Recipient
  advisory locks serialize gifts that extend the same Silver subscription.
- Repeating an identical completed ring-to-recipient assignment returns success
  without extending Silver or sending notifications again. A replay must also
  match the saved message; it cannot rewrite a sent note. The browser retains
  the attempted payload after network failure, including if a ring expires
  before the retry. No replacement ring is silently spent.
- The legacy single-gift endpoint still chooses the **soonest-to-expire** ring
  using `FOR UPDATE SKIP LOCKED`, for compatibility with existing clients.
- The receiver gets **a month of Silver**, by the same rule as a member's own
  payment (`addSilverTime`, `subscriptions/silver-time.ts`):
  - it runs on from where their Silver ends, or from now when it has run out;
  - while Silver the founders gave them is running, the month goes to their own
    time (`paidUntil`), theirs if the gift is ever taken back.
  - A Silver check held after a name or photo change stays held. Unlike an
    admin confirming a payment, a ring from another member vouches for nothing.
- The receiver is told: "Ada gave you a Kink Ring: a month of Silver". The push
  goes at once, is held through quiet hours, and has no switch, like account
  notices. Tapping it opens the giver's profile. An optional personal message is stored
  on the ring and displayed as plain text in the recipient's notification inbox.
  The inbox query checks the ring's recipient and giver before returning the
  note; public profiles and other members never receive it. Push previews keep
  the existing generic gift text.
- Dates are shown in Lagos time. Gifting history and expired inventory paginate
  in pages of 20. Active/Expired in history describes the recipient's **current
  Silver status**, not a separately tracked expiry of that particular gift.
  Unavailable recipients display without profile details.

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

### Inventory and gifting flow endpoints

All routes require authentication and derive ownership from the session.

| Route | Behavior |
| --- | --- |
| `GET /kink-rings/inventory` | Available rings plus the first history and expired pages |
| `GET /kink-rings/history?page=1` | Gift history, `items` and `nextPage` |
| `GET /kink-rings/expired?page=1` | Expired unspent rings, `items`, `total`, `nextPage` |
| `GET /kink-rings/recipients?tab=friends&q=&page=1` | Eligible accepted friends; `tab=search` requires two characters and honors search privacy |
| `POST /kink-rings/give-selected` | `{ gifts: [{ ringId, username, message? }] }`, 1–50 distinct owned rings; atomic and idempotent for the same assignment |

Migration `0048_kink_ring_gift_message` adds a nullable `gift_message` column.
Apply it before deploying the updated API. Existing rings keep a null note; no
existing balances, Silver grants or payment rules are changed.

## Data

`kink_ring` (migration 0046):
- `owner_id`
- `payment_id` (null for the founders' rings)
- `seq` (1 to 12)
- `expires_at`
- `given_to`, `given_at`
- `gift_message` (nullable, migration 0048)

A ring is **available** while `given_at` is null and `expires_at` is ahead.
Rings go with their owner's account. The giver's record stays if the receiver
leaves.

## Not yet

- A "Give a Kink Ring" button on members' profiles.
- Mentioning rings on the Silver plans screen.
- Telling a member when one of their rings is about to expire.

## Artwork

The overview hero is `apps/web/public/kink-rings/gold-heart-ring.webp` and the
confirmation illustration is `apps/web/public/kink-rings/gift-box.webp`, generated with
`image_gen` from the supplied ring reference. The UI and text are rendered in
React. [Generation prompt and asset details](KINK_RINGS_ARTWORK.md).
