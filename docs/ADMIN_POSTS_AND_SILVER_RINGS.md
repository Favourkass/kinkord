# Silver rings, black theme and global post moderation

Silver's existing eligibility and admin approval rules are unchanged. A shown Silver status now gives the member's avatar a silver ring/frame; the adjacent shield/check is removed. The manually assigned gold Kinkord Team badge stays separate. Plan and approval panels use a silver ring indicator too.

Kinkord uses the black theme on the server's first frame, during initialization and throughout the app. Old saved Light preferences are ignored/overwritten. Settings no longer offers a Light theme.

Admins open **Moderation → All posts** (`/moderation/posts`). The server returns all countries and visibility levels, including friends-only posts and suspended authors, in stable newest-first pages of 20. Status filters are All, Active, Archived and Deleted. Media previews are signed only at the authenticated admin boundary. Every list/action requires both AuthGuard and AdminGuard.

Archive/Restore updates `post.archived_at` and writes an admin audit record in one transaction. Archive retains media/reactions and hides content from regular feed, search, profile/media reads, reposts and post gifting; restore respects the original visibility. A deleted post cannot be restored by this action. Delete uses the existing moderation deletion workflow, including media deletion, with an explicit irreversible-action confirmation.

Migration `0033_post_archiving` only adds a nullable archive timestamp. Existing posts remain active. Run it before rolling out the API and web. No production migration, push or deployment has been performed.

Verification includes permission/validation tests, global pagination and status tests, confirmation/error presenter tests, existing feed/privacy tests, and a local PostgreSQL archive/restore test that rolls back its fixtures after checking retained media and audit entries.
