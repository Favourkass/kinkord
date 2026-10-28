# Mutual privacy

Every active privacy field uses the same backend rule: member A may view or interact with that part of member B's account only when **B's audience includes A and A's audience includes B**. Blocks still deny access. Members retain access to their own information.

Examples:

- `profilePhoto: onlyMe` hides other members' profile photos from the viewer, including directory cards, profiles, comments, inbox rows and notifications.
- `directory: onlyMe` prevents browsing other members in the directory, including a name search within a country directory. Global Kinkord search has its own reciprocal `search` setting.
- A friends audience requires an accepted friendship; a pending request does not qualify. Follower and following audiences are evaluated from each account's perspective.
- Profile privacy does not reduce anonymous community population totals. Existing small-population suppression still applies.
- Post audiences, blocks and suspended-account restrictions remain additional conditions.

## Messaging

Settings → Privacy → Messaging, Friend Requests & Following includes **Who Can Send Me a Message**. It saves one audience using the existing authenticated privacy API and JSON settings storage. No database migration is needed. Existing accounts default to Kinkordians until they change this setting.

Both accounts' messaging audiences must permit sending, independently of Premium and daily chat limits. A rejected send returns HTTP 403 with code `MESSAGING_PRIVACY`; subscribing cannot bypass this restriction. The rule is checked when creating a new thread, sending text or photos, requesting a photo upload, and publishing typing hints. Existing threads and messages remain readable. The chat header exposes `peer.canMessage`; the UI replaces its composer with an explanation when messaging is disallowed. Header refreshes pick up subsequent changes.

The web privacy mapper accepts older API responses without the messaging field during rollout. Deploy the API with the web changes to enable the new permission fully. Real email verification is unchanged.

## Existing unavailable controls

Stories and member-managed pinned posts remain disabled until their features are available. “Verified members” is not selectable while identity verification is switched off. These limitations are not replaced with ineffective controls.

## Validation

- API regression suite: privacy policy/service, chat, members, posts, tags, mentions, relationships and notifications.
- Web regression suite: privacy model/service/presenter, privacy controls, chat presenter/view and service.
- An isolated PostgreSQL-compatible database check evaluated every field with public, only-me, friends, pending/accepted friendship and blocked cases; also checked directed follows, countries, continents, current identity verification, default/legacy settings, empty directory results and redacted avatar keys.

For a manual two-account check, set A's profile-photo or directory audience to Only me. A should not see B's photo or directory entry, and B should not see A's. Switch back to Kinkordians to restore access only if B's setting also allows A. Repeat with messaging: an existing thread remains readable but neither side can send until both audiences permit it.
