# Notifications

What reaches a member's phone, and when. The founder set these rules on
2026-10-26. They live in one pure module, `apps/api/src/push/push-policy.ts`,
unit-tested in `push-policy.spec.ts`.

Every notification lands in the member's Notifications list at once. These
rules only decide the **push** to their devices: now, later, or not at all.

## Now, later, or not at all

| Kind | Push |
| --- | --- |
| Messages | At once, day or night |
| Comments, mentions, tags, friend and relationship requests | At once; held through quiet hours |
| Account notices (Silver payment, identity verification) | At once; held through quiet hours |
| Likes, reposts, new followers | Bundled (below); held through quiet hours |
| Moderators' alerts (reports, payments, Silver checks, verifications) and the push test | Always at once |

- **Bundling.** The first like (or repost, or follow) pushes at once. After
  that, each of those types pushes at most once every **2 hours**, as one push
  for everything that came in meanwhile: "Ada and 6 others liked your posts".
  No more than **8** bundled pushes go out in 24 hours; the rest wait until
  there's room.
- **Quiet hours.** From **11pm to 7am** in the member's own time, only messages
  push. The rest waits and goes out after 7am, one push per type.
- **Switches.** Settings → Notifications has a switch for messages, comments
  and mentions, tags, friend and relationship requests, likes and reposts, and
  new followers. A kind that's off never pushes but still shows in the list.
  Account notices and moderators' alerts have no switch.
- **Discreet.** A push says who, never what: no message text, no post text.

## Time zones

From the profile: Nigeria `Africa/Lagos`, Ghana `Africa/Accra`, Kenya
`Africa/Nairobi`, and the US by state (Eastern unless the state is in the
Central, Mountain, Arizona, Pacific, Alaska or Hawaii list). Without a
country, Lagos.

## How it runs

- `PushService.deliver` stores the notification, then asks
  `PushScheduleService.decide` (the member's switches, zone, the last push of
  that type and the last 24 hours' bundled count).
  - **send:** pushes now, and records it in `push_sent`.
  - **hold:** sets `notification.push_pending`.
  - **drop:** does nothing more.
- `PushDigestService` runs every 5 minutes, one API instance at a time under
  an advisory lock. For each member and type with held rows it decides again.
  - **send:** one push for all of them, linking to the post or profile when
    there's just one, else to the Notifications list.
  - **hold:** the rows wait for the next run.
- A held row that was read in the app, or is older than 48 hours, is let go
  without a push.
- `push_sent` keeps two days of history.
