# Groups

FetLife-style groups: forums around a place or an interest. The founder's choices (2026-10-20):

- **Silver members create groups**; anyone can join. The founders and admins can create too, to seed Kinkord's own groups. A new account waits 7 days, and one member owns at most 5 groups.
- **Open or closed**, chosen once at creation. Open: anyone joins at once, and any signed-in member reads the discussions and the member list. Closed: the moderators approve each join, and only members read; everyone still sees the name, description, rules and who runs it.
- **Discussions stay in their group.** They never reach the home feed, a profile's Posts or Media tab, search, reposts, saves or gifts.
- **Profiles list open groups** a member is in ("Groups & Communities", per the Figma card), unless they turn it off (Edit Profile → Privacy → Groups on Profile). Closed groups never show.

## Roles

One owner, any number of moderators, and members.

- **Moderators:** approve or decline requests; pin, close and remove discussions; remove replies; remove members (not the owner, and only the owner removes a moderator); edit the group.
- **The owner also:** renames the group, makes and unmakes moderators, and closes the group down. The owner can't leave. Closing down hides the group and everything in it; Kinkord can restore it (Admin → Groups).

Every moderator action is written to `group_log`.

Members can like and reply; anyone who can read an open group can read but not take part until they join. A block hides each person's discussions and replies from the other, except from the group's moderators. Ten new discussions a day per member, across all groups.

## How it's built

- **Tables:** `community_group`, `group_member` (one `owner` row per group, by unique index), `group_log`. Migration `0036_groups` only adds tables and columns.
- **Discussions are posts** with `post.group_id`, `title`, `pinned_at`, `closed_at` and `last_activity_at` (a reply moves a discussion back to the top). Likes, replies (oldest first), mentions and media reuse the post code.
- **Visibility.** `visibleTo` (`apps/api/src/posts/visibility.ts`) leaves every group post out unless a read asks for `{ groups: true }`. Only the group's own reads do (its discussions, one discussion, replies, likes, the post page that redirects to the group). Then it admits only the groups the viewer may read (`groupReadableBy`).
- **Mentions** in a closed group notify only members.
- **Notifications:** `group_request` goes to the owner and moderators when someone asks to join a closed group. `group_approved` goes to the member. Push text names who, never the group.

## Pages

- `/groups`: the directory (Your groups, Near you, Popular, New; search; categories).
- `/groups/new`: create a group.
- `/g/<slug>`: the group (Discussions, About & rules, Members, and Requests for a closed group's moderators).
- `/g/<slug>/edit`: edit the group.
- `/g/<slug>/t/<id>`: a discussion.
- `/moderation/groups`: Admin → Groups.

## Later (release 3)

- Bans and timeouts.
- A moderator log page.
- Reporting groups and discussions.
- Invites.
- Handing ownership on.
- Group chats (the inbox's "Groups" filter in Figma).
