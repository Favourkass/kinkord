# Profile pinned posts

Members can pin one of their own available original posts from the post menu. Pinning another replaces the previous pin atomically. Unpinning restores chronological profile ordering; a delayed unpin cannot remove a newer replacement.

Profile pages put the pinned post first, followed by posts ordered by creation time and ID. Profile cursors include pin status, millisecond timestamp and ID so an older pin or equal timestamps do not skip ordinary posts. Changing a pin refreshes the profile page and pagination cursor. Home timeline ordering is unchanged.

Pinning does not bypass post visibility, blocks, moderation, or mutual privacy. The Pinned Posts audience setting is now available and applies wherever a pinned post appears, including reposts. Archived or deleted posts remain hidden.

## Deployment

This feature builds on the mutual privacy controls branch (PR #287). Apply migration `0047_profile_post_pin.sql` before deploying the API. The migration adds a separate table and does not rewrite existing posts. No demo email verification configuration is included.

## Validation

- 318 API tests across posts, privacy and members.
- 216 web tests covering domain mapping, API calls, presenters, privacy settings and post menus.
- Four temporary isolated PostgreSQL-compatible integration checks using PGlite: actual migration, replacement/stale unpin, equal-timestamp pagination with an old pin, reciprocal visibility, and archived/deleted visibility.
- API and web TypeScript checks, changed-file ESLint, and diff whitespace checks.
