# Sharing a post

The Share button on a post opens a sheet on the home, profile, saved and single-post screens. From it a member can:
- share the post to their feed, with an optional caption
- send it to a friend
- open WhatsApp or X
- use the phone's own share menu
- copy the link

Repost and Quote are no longer separate actions: the sheet's **Share now** replaces the Repost item that was in the post's ⋯ menu. Earlier reposts stay as they are and show as shared posts.

## Sharing to your feed

`POST /posts/:id/share-feed` `{ caption }`, with captions up to 2,000 characters.
- **The share is a repost row.** The caption is its body and sits above the original, which stays untouched.
- **Once per post:** a member can share a post once, the existing repost rule. A second try is refused.
- **Removing it:** the member removes their share from their own profile ("Remove shared post"). The original is unaffected.
- **What can be shared:** only public posts, and only by members inside the author's "Who Can See My Content When it is shared". Outside that audience the post can't even be opened. Every later read still checks visibility, blocks and moderation.
- **The author is told:** "… shared your post", bundled with likes and new followers.

## Sending to a friend

- **Who's offered:** the sheet lists accepted friends whose "Who Can Send Me a Message" lets the member write to them (`GET /posts/share-friends?q=`).
- **What's sent:** the caption, then the post's link, through chat itself.
  - The messaging setting, blocks, the country rules and the daily new-chat allowances all still apply.
  - The friend can only open the link if they could see the post anyway.

## Counting shares

The post's share count counts each member once. These count:
- sharing to the feed
- sending to a friend
- the phone's share menu
- copying the link

Opening WhatsApp or X doesn't count, since that doesn't prove anything was sent.

Duplicate taps are locked while a share is sending. A retried friend message reuses its id, so it never arrives twice.

## Not in this release

Daniel's #291 also built private, invite-only groups that friends share posts into. Those were left out, to be decided together with the planned Groups (#236).
