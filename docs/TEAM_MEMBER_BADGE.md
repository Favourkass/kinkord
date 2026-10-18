# Kinkord Team badge

The supplied gold check identifies an official Kinkord team member. It is independent of Silver, identity verification, friendship, following and administrator privileges. No account receives it automatically, including existing admins and founders.

A founder opens Moderation → Members, searches for the member and opens their detail page. The **Kinkord Team badge** section assigns/removes the badge after confirmation. Only the founders can do either: the badge tells members someone speaks for Kinkord, so a staff admin sees whether a member has it but can't change it (the API refuses them too). Both actions write an actor/subject entry to the moderation log in the same database transaction as the assignment. A badge never grants admin permissions. Public profile edits cannot write the flag.

Migration `0032_team_member_badge` adds a non-null `profile.team_member` flag defaulting to false. Deploy this additive migration before the updated API and web. No follows, friendships, subscriptions or existing identity verification are modified. No production migration has been run.

The badge appears with the member name on profiles, directory/nearby/search cards, People lists, posts/comments/mentions, chats and notifications. Its accessible label and tooltip explicitly say **Kinkord Team member**. Assigning or removing takes effect on subsequent reads of those views; no historical post or notification copies of the status are stored.
