# Profile pinned posts

A member can pin one of their own posts to the top of their profile from the post's menu (**Pin to profile**). Pinning another post replaces the pin. **Unpin from profile** puts the post back in date order.

- **What can be pinned:** only the member's own original posts that aren't deleted or archived. Not reposts, and not anyone else's posts (the API answers 404).
- **One pin per member** (`profile_post_pin`, migration 0047). Pinning replaces the previous pin in one upsert. A late unpin of an old post never removes a newer pin.
- **Profile order:** the Posts tab shows the pinned post first, then the rest newest first.
  - Its cursor carries the pin, the millisecond timestamp and the post id, so paging never skips or repeats a post, even after an old pin or with equal timestamps.
  - Changing the pin reloads the profile.
- **Home feeds** keep their own order. The post shows "Pinned to profile" there too.
- **Who sees it:** a pinned post follows its own audience. Pinning never changes who can see a post. Its audience, blocks, moderation and the author's "Who Can See My Posts" still decide. "Who Can See My Pinned Posts" stays switched off, since it would do nothing (see PRIVACY.md).

## API

| Route | |
| --- | --- |
| `POST /posts/:id/pin` | `{ postId, pinned: true }`. 404 unless it's the member's own available original post. |
| `DELETE /posts/:id/pin` | `{ postId, pinned: false }`. Only removes the pin if it's still on this post. |

Posts carry `isPinned`. The migration only adds the `profile_post_pin` table, and runs when the API starts, like every migration.
