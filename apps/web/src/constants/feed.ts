/** Copy for the home feed (Figma "Hompage Light" 344:138 / dark 837:295). */

export const FEED_COPY = {
  composerPlaceholder: "What's on your mind?",
  composerOpen: "Write a post",
  composerTitle: "Create post",
  composerSubmit: "Post",
  composerPosting: "Posting…",
  composerCancel: "Cancel",
  addPhoto: "Add photo",
  addPhotoShort: "Photo",
  removePhoto: "Remove photo",
  photoLimit: "You can attach up to 4 photos.",
  visibilityLabel: "Who can see this",
  visibilityPublic: "Everyone",
  visibilityFriends: "Friends only",
  more: "more",
  less: "less",
  like: "Like",
  unlike: "Unlike",
  comment: "Comment",
  repost: "Repost",
  save: "Save",
  saved: "Saved",
  unsave: "Remove from saved",
  unrepost: "Undo repost",
  repostedBy: (name: string) => `${name} reposted`,
  share: "Share",
  shareCopied: "Link copied",
  postHeading: "Post",
  postGone: "This post is no longer available.",
  savedHeading: "Saved",
  savedEmpty: "Nothing saved yet. Tap the bookmark on a post to keep it here.",
  postMenu: "Post options",
  /** Announced on the controls that are drawn but have no backend yet. */
  comingSoon: "coming soon",
  deletePost: "Delete post",
  deletePostConfirm: "Delete this post? This cannot be undone.",
  /** Undoing a repost touches only your own row; the post itself is untouched. */
  removeRepost: "Undo repost",
  removeRepostConfirm: "Remove your repost? The original post stays where it is.",
  comments: "Comments",
  commentsEmpty: "No comments yet. Be the first.",
  commentPlaceholder: "Write a comment…",
  commentSubmit: "Send",
  commentDelete: "Delete comment",
  commentsMore: "Load more comments",
  closeComments: "Close comments",
  loadMore: "Load more",
  loading: "Loading…",
  feedEmptyTitle: "Your feed is quiet",
  feedEmptyBody: "Follow a few kinksters, or write the first post yourself.",
  feedError: "Could not load the feed. Refresh to try again.",
  peopleHeading: "People you may know",
  peopleSeeAll: "See all",
  peopleDismiss: "Hide suggestions",
  peopleAdd: "Add friend",
  peopleAdded: "Remove",
  /** Desktop right rail, which the mobile frame has no room for. */
  asideHeading: "Kinkord",
  asideTagline: "The world's kink community",
} as const;

/** Photos per post, matching the API's POST_MEDIA_MAX. */
export const FEED_PHOTO_LIMIT = 4;

/** How many suggestions the strip asks for. */
export const FEED_SUGGESTION_LIMIT = 10;

export const FEED_VISIBILITIES = [
  { value: "public", label: FEED_COPY.visibilityPublic },
  { value: "friends", label: FEED_COPY.visibilityFriends },
] as const;

/** Every label a post card needs, shared by the home feed and the profile Posts tab. */
export const POST_CARD_LABELS = {
  like: FEED_COPY.like,
  unlike: FEED_COPY.unlike,
  comment: FEED_COPY.comment,
  repost: FEED_COPY.repost,
  unrepost: FEED_COPY.unrepost,
  save: FEED_COPY.save,
  unsave: FEED_COPY.unsave,
  share: FEED_COPY.share,
  more: FEED_COPY.more,
  less: FEED_COPY.less,
  menu: FEED_COPY.postMenu,
  delete: FEED_COPY.deletePost,
  repostedBy: FEED_COPY.repostedBy,
} as const;
