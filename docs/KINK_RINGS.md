# Kink Rings

A Kink Ring is a month of Silver a member can give to someone else. The
founders set the rules on 2026-10-27.

## Getting rings

- **How many each plan brings is the founders' setting**, on Moderation →
  Kink Rings (0 to 24 per plan, stored in `app_setting` as
  `kink_rings_monthly` and `kink_rings_yearly`). Until they set it: **1** for
  a month, **12** for a year.
- A checkout records the count on offer then (`subscription_payment.rings`),
  and confirming the payment brings that many, whatever the setting says by
  then. Payments from before the setting existed bring 1 or 12.
- Each ring expires a month of Silver after the payment is confirmed, so the
  rings run out a month apart. The Nth ring expires **30 × N days** after
  confirmation: 30 days for the first, 60 for the second, and so on (360 for
  a twelfth).
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

**Buy Kink Ring opens `/kink-rings/buy`**. Separate purchases cost **$5 per
2 rings** until the founders set another price on Moderation → Kink Rings
(app setting `kink_ring_pair_usd_cents`, $0.50 to $500; founders only, logged as
`set-kink-rings`). Quotes and new checkouts use the price at that moment; a
checkout already started keeps its amount, and a member whose quote went stale is
asked to review the new total. Purchases come in multiples of two (2–100 per
checkout). Purchased rings expire
**90 days after payment confirmation**; bank purchases are confirmed on admin
approval. Existing monthly/yearly Silver bundles keep the expiry rules above.

- KinkCoin checkout uses the configured wallet coin **buy** rate in USD cents,
  rounding up to whole coins. At 10 cents per coin, two rings cost 50 coins.
  Balance debit, payment ledger and ring issuance commit in one transaction.
  Bought coins are used before earned coins; spending appears in wallet history.
- Bank checkout uses the configured wallet exchange rate and payment bank
  account. The server assigns an exact unique amount and a reference. Members
  transfer, upload a receipt and sender details, then submit for review. No rings
  are issued before approval. Admin approval issues rings once without extending
  the buyer's Silver; approval/rejection notifies the buyer.
- Each checkout carries a member-bound idempotency key. The browser retains an
  uncertain purchase in session storage across refresh and retries the same key.
  Rate changes and insufficient balances are rejected before any charge.
- `/kink-rings/purchases` lists the signed-in member's purchase history. Payment
  details and proof routes remain owner-scoped. Submitted status polls for review
  results. Coin purchases complete immediately without a receipt.
- Gifting ends with a success screen showing the actual recipients, quantities,
  personal messages and server confirmation time. Recipients receive Silver
  immediately; there is no separate activation step.

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

## Admins

On a member's admin page (Moderation → Members → member), admins see each
payment's rings: who got each one and when, which expired unused, and the
balance left to give, plus the rings others gave the member. Notes stay
between the members; only that one was sent shows.

Two actions, each with a required reason (stored on the ring and in
`moderation_log`):

- **Cancel unused rings** (`POST /admin/members/:id/kink-rings/cancel`):
  every ring the member still has to give is marked `revoked_at`, so their
  balance is zero. Given rings, and the Silver they gave, stay. Nothing is
  deleted.
- **Cancel Silver** (`POST /admin/kink-rings/:ringId/cancel-silver`): takes
  back the month of Silver a given ring added (`usage_cancelled_at`). The
  receiver's Silver ends a month sooner, but never sooner than their own
  payments and their other rings carry it, so paid time is never lost. A
  member whose only Silver was that ring is on Basic from now. While the
  founders' Silver runs, the month comes off the time set aside for them
  (`paid_until`) instead. The ring itself stays given.

`GET/PUT /admin/kink-rings/settings` read and set the rings per plan; only the
founders may change them.

## Data

`kink_ring` (migration 0046):
- `owner_id`
- `payment_id` (null for the founders' rings)
- `seq` (1 up to the plan's count for Silver; 1 up to the quantity bought for a purchase)
- `expires_at`
- `given_to`, `given_at`
- `gift_message` (nullable, migration 0048)
- `revoked_at`, `revoked_by`, `revoke_reason`: an admin took it back unused
  (migration 0050)
- `usage_cancelled_at`, `usage_cancelled_by`, `usage_cancel_reason`: an admin
  took back the Silver it gave (migration 0050)

A ring is **available** while `given_at` and `revoked_at` are null and
`expires_at` is ahead.
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

## Separate purchase API and rollout

Migration `0049_ring_purchases` adds the payment purpose, quantity, method,
member-bound request key and coin spending ledger fields, with uniqueness and
quantity/coin constraints. Apply it before the API and web release. Existing
payments default to Silver/bank; existing balances and rings are unchanged.

| Route | Behavior |
| --- | --- |
| `GET /kink-rings/purchase-quote?quantity=2` | Current server price, payment availability, balance and ring count |
| `POST /kink-rings/checkout` | Quantity, method, senderId, requestKey and expected quote; atomic, replay-safe checkout |
| `GET /kink-rings/purchases?page=1` | Owner-only payment history, 20 per page |

Receipt upload, proof submission and admin review reuse subscription payment
routes and authorization, branching on payment purpose. Bank account details
always come from configuration, never artwork sample account numbers.

`scripts/tests/ring-purchases-integration.cjs` runs all migrations against an
isolated PGlite database and covers spending, rollback, replay, approval,
rejection, ownership, history, notifications and gift fulfillment. Set
`PGLITE_MODULE` to an installed PGlite module and build `apps/api` first. It does
not connect to production or exercise real bank payments.
