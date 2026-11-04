# Privacy settings

Settings → Privacy gives each member an audience for each part of their account:
- Kinkordians, meaning everyone
- Friends
- Followers
- People I follow
- People in my country or my continent
- Only me

The API applies them with `privacyAllows` in `apps/api/src/privacy/privacy-policy.ts`. Blocks hide everything both ways, and each post's own audience still applies.

## One-way, except three settings

A setting only limits who can see the member's own things. Narrowing your own never hides anyone else's posts, photos or profile from you, or an organization's posts. The founders chose this on 2026-10-24 (#261). They kept it on 2026-10-28, when #287 proposed making every setting work both ways.

Three settings work both ways (`MUTUAL_FIELDS`):

- **Online status:** hide yours from someone and you can't see theirs.
- **Read receipts:** you only see someone's if you share yours with them.
- **Who Can Send Me a Message:** you can only write to members who could write back.

How the audiences are read:
- A Friends audience needs an accepted friendship. A pending request doesn't count.
- Followers means people who follow the owner. People I follow means people the owner follows.
- Members who used the old Profile Visibility switch on "friends" keep Friends for their bio, interests, relationship status and Media tab until they choose something else.

## What admins see

The founders and staff admins (`isAdmin`: a founder's verified email, or a `staff` row) see every member in the app, whatever the member chose (founders, 2026-10-29). This is `ADMIN_SEES` in `privacy-policy.ts`.

**What it covers:**
- finding the member in the members directory and in search
- the profile photo and cover photo
- the bio and About details, location, interests and relationship status
- followers and following, and the profile's Media tab

**What it doesn't change:**
- **Posts** keep their own audience and the member's "Who Can See My Posts". The admin tools' All posts screen is for moderation.
- **Online status, read receipts, messaging and tagging** keep the member's own settings.
- **Blocks still apply**, and suspended members stay out. Moderation → Members finds anyone, blocked or suspended.

Settings → Privacy tells members that admins can always find them and see their profile.

## Who Can Send Me a Message

This setting is under Settings → Privacy → Messaging, Friend Requests & Following. It's stored with the other settings, so there's no migration. Everyone is on Kinkordians until they change it.

- **When it's checked:** starting a chat, sending text or a photo, asking for a photo upload link, and sending typing hints.
- **A refusal** is a 403 with code `MESSAGING_PRIVACY`. Silver doesn't get round it, and the daily new-chat allowances still apply on top.
- **Existing chats** stay readable. Neither member can write in one while either member's setting leaves the other out. The chat header's `peer.canMessage` is then false, and the app explains why in place of the composer.
- **Older API responses** without a `messaging` setting are read as Kinkordians by the web.

## Directory and search

- **Who Can Find Me in the Members Directory** covers browsing the directory and searching by name inside it.
- **Who Can Find Me Through Kinkord Search** covers the app's search across every country.

Neither changes the member totals. Those count everyone except suspended accounts, and show nothing for a place with fewer than 10 members.

## Meet the Team

Meet the Team (`/about/team`, API `GET /team`) is open to anyone, signed in or not. Besides the CEO's card, it shows the members the founders add on Moderation → Team page. For each one it shows only their profile photo, display name, @username, and the role the founders typed. Their privacy settings don't hide them from it: being added is the founders' decision, made with the member.

- **Adding someone** gives them the Kinkord Team badge.
- **Removing someone** takes them off the page, and so does taking the badge away on their member page.
- **Blocked members** are left off the page, whatever their role.
- **Fixed places:** an account in `FIXED_TEAM_TITLES` (`apps/api/src/moderation/admins.ts`, matched by verified email the way founders are) keeps its badge and role whatever happens.
  - The API sets them again on every start, and shows the account first.
  - The admin Team page doesn't list it.
  - The Team page, and the badge button on the member page, refuse to change it.
  - Only a code change can move or remove it.

## Not available yet

The API refuses to save these:

- **Stories:** greyed out in the app, since there are no stories yet.
- **Pinned posts:** not shown in the app at all. A pinned post follows its own audience (PROFILE_PINNED_POSTS.md), so there's nothing to set.
- **Verified members:** not offered as an audience while identity verification is switched off.
