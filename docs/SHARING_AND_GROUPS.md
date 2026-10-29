# Post sharing and private groups

The post Share action opens a black-and-gold sheet on home, profile, saved and individual-post screens. Members can share directly to their feed, add a caption, send a post link to a friend, choose a joined Kinkord group, open WhatsApp or X, use the device share sheet, or copy the link. Repost and Quote are not exposed as separate actions. Existing repost rows remain intact and display as shared posts; storage/API compatibility is retained.

A feed share stores its caption separately from the original body and media. One active feed share per member/original is retained by the existing database uniqueness rule. Removing your shared row leaves the original untouched. Only public originals permitted by the author's sharing privacy can be shared into feeds or groups. Every later read still checks visibility, blocks, moderation and sharing privacy. Friend messages contain a link and optional caption; recipients must have access to open the original. Existing messaging permissions, country rules and daily new-conversation allowances remain in force.

## Groups

Groups are private shared-post feeds, available from the account menu and share sheet. Owners create a named group and invite accepted friends who allow contact. Invitees accept or decline from Groups before seeing posts; pending invitations never appear as share destinations. Owners can invite more friends, remove members or invitations, remove group shares, and delete the group. Members can leave and remove their own group shares. Group deletion removes memberships and group shares without deleting original posts.

Limits: 50 invitations per request, 100 members/invitations per group, 20 groups owned by a member. One share of an original per member per group prevents duplicate submissions. Group feeds load 20 entries at a time; privacy-filtered entries are omitted. The current group list shows the latest 100 memberships/invitations. These groups are shared-post feeds; group chat and public group discovery are outside this change.

## Counts and delivery

The existing unique-member share counter is retained. A completed feed/group share, friend message, native share, or copy can record it. Opening an external WhatsApp/X window is not proof of delivery and does not increment it. Native cancellation keeps the share sheet open without an error. Duplicate taps are locked while sending; friend-send retries reuse the message client ID. Counter refresh failures do not turn a completed action into a failed-send prompt.

## Rollout

Apply generated migration `0048_member_groups.sql` before deploying the API, then deploy web. No production database migration is executed by this development task. No demo email/OTP code or environment files are included.

## Validation

API and web unit/regression tests cover sharing permissions, captions, duplicate actions, message failures, invitation consent, group ownership and controls. Isolated PGlite tests execute the actual migration and service SQL for invite/accept/share/remove/delete, original-post preservation and blocked/private access. A mobile Chromium check with mocked API fixtures covers the share sheet, captions, friend/group destinations, group creation and group feed, with no horizontal overflow or browser errors.
