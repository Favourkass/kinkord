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
  share: "Share",
  postMenu: "Post options",
  deletePost: "Delete post",
  deletePostConfirm: "Delete this post? This cannot be undone.",
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
