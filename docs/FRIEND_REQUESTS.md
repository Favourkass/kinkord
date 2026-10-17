# Friend requests

Follow is independent of friendship. Sending a request does not follow the recipient, and accepting, declining, cancelling or removing a friend never changes a follow. Crossed requests remain pending until the recipient explicitly accepts.

## Existing accounts

Migration `0031_friend_requests` adds the friendship table and copies each pre-existing mutual-follow pair into one accepted friendship. It leaves every follow row untouched and emits no notifications. One-way follows remain one-way follows. After migration, new mutual follows do not become friends. Accepted friendships now control friend counts, lists, mutual-friend lists, friends-only profiles, media, posts, and private-interest matching.

## API and UI

Authenticated `/friendships` endpoints send, accept, cancel/decline, remove and list requests. The canonical pair key prevents duplicate pending pairs; atomic status predicates prevent senders or third parties accepting requests, and prevent late cancellations deleting accepted friendships. New/accepted requests use distinct inbox and push notification types. A request can be cancelled or declined without notifying the sender. Request notices are limited to one per sender per recipient per UTC day to prevent cancel/resend notification spam.

The member profile has separate Follow and Add Friend controls. Received requests offer Accept and Decline; sent requests offer Cancel. The notification opens `/friends/requests`; own profiles also link to it. Blocks and suspensions prevent sending or accepting requests. The requests page is private and excluded from indexing.

## Release

Deploy the migration and API together before the web UI. Drain old API instances during cutover: avoid mixed old/new social-graph behavior while the one-time snapshot and API rollout run. The migration takes a SHARE lock on `follow` for the duration of the backfill inside the migration transaction; review timing on a staging copy first. Never replace the backfill with a permanent mutual-follow fallback, since that would create new friendships without consent.

No production migration or deployment has been executed by this change. No followers need to re-follow, and preserved friends do not need to send requests again.

## Verification

Run the API and web tests, typechecks and lint. For an isolated PostgreSQL migration and concurrency check, build `apps/api`, then set `FRIENDSHIP_TEST_DB_URL` to a **local** PostgreSQL connection with permission to create disposable databases and run `node apps/api/scripts/check-friendships.cjs`. It creates and removes only its own temporary database. It verifies legacy preservation, unchanged follows, duplicate/crossed requests, recipient-only acceptance, post privacy, cancellation, decline, removal and blocks.
