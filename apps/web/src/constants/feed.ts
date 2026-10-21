/** Copy for the home feed (Figma "Hompage Light" 344:138 / dark 837:295). */
import type { FeedTab, SuggestionShow } from "@/domain/post";

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
  gift: "Gift",
  coin: "Coin",
  star: "Star",
  crown: "Crown",
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
  /** The list of members to mention, while "@" is typed. */
  mentionSuggestions: "Members to mention",
  commentSubmit: "Send",
  commentDelete: "Delete comment",
  commentsMore: "Load more comments",
  closeComments: "Close comments",
  loadMore: "Load more",
  loading: "Loading…",
  /** The For You | Following | Nearby tabs at the top of the home feed. */
  tabsLabel: "Home feed",
  tabs: { for_you: "For You", following: "Following", nearby: "Nearby" } satisfies Record<
    FeedTab,
    string
  >,
  feedEmptyTitle: "Your feed is quiet",
  feedEmptyBody: "Follow a few kinksters, or write the first post yourself.",
  /** Following, for a member who follows nobody yet. */
  noFollowsTitle: "You're not following anyone yet",
  noFollowsBody: "Follow kinksters to see their posts here, wherever they are.",
  noFollowsAction: "Browse kinksters",
  followingEmpty: "Nothing from the kinksters you follow yet.",
  /** Nearby, for a member with no state on their profile. */
  noLocationTitle: "Where are you?",
  noLocationBody: "Add your location to see posts from kinksters near you.",
  noLocationAction: "Add your location",
  nearbyEmpty: "Nothing near you yet.",
  feedError: "Could not load the feed. Refresh to try again.",
  peopleHeading: "Kinksters Near You",
  /** The sliders button: the members directory, where every filter is. */
  peopleBrowse: "Browse all kinksters",
  /** The Women | Men (| All) toggle. */
  peopleShowLabel: "Show",
  peopleShow: { women: "Women", men: "Men", all: "All" } satisfies Record<SuggestionShow, string>,
  peopleOnline: "Online",
  peopleLookingFor: "Looking for",
  peopleRemove: "Remove",
  peopleEmpty: "No one to suggest here yet.",
  /** Members and the official organization alike are followed, on posts and in the strip. */
  follow: "Follow",
  following: "Following",
  /** Tagging friends in a post (founder, 2026-10-21). */
  taggedWith: "with",
  removeTag: "Remove my tag",
  tagFriends: {
    button: "Tag",
    title: "Tag friends",
    search: "Search your friends",
    loading: "Looking…",
    empty: "No friends match. Only friends can be tagged.",
    full: "That's the most you can tag in one post.",
    done: "Done",
    with: "with",
    remove: (name: string) => `Remove ${name}`,
  },
  organization: "Official",
  verifiedOrganization: "Official Kinkord account",
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
  gift: FEED_COPY.gift,
  coin: FEED_COPY.coin,
  star: FEED_COPY.star,
  crown: FEED_COPY.crown,
  more: FEED_COPY.more,
  less: FEED_COPY.less,
  menu: FEED_COPY.postMenu,
  delete: FEED_COPY.deletePost,
  repostedBy: FEED_COPY.repostedBy,
  organization: FEED_COPY.organization,
  verifiedOrganization: FEED_COPY.verifiedOrganization,
  follow: FEED_COPY.follow,
  following: FEED_COPY.following,
  with: FEED_COPY.taggedWith,
  removeTag: FEED_COPY.removeTag,
} as const;

/** Display-ready controls for the post editor. */
export const FEED_EDITOR = {
  formats: [
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "underline", label: "Underline" },
  ] as const,
  labels: {
    toolbar: "Post formatting",
    emoji: "Add emoji",
    preview: "Preview formatting",
    previewTitle: "Post preview",
    edit: "Back to writing",
    text: "Post text",
    hint: "Enter starts a new line. Use **bold**, *italic* or __underline__.",
    limit: "There isn't enough room for that. Shorten your post and try again.",
  },
  emojis: [
    { value: "😀", label: "Grinning face" },
    { value: "😊", label: "Smiling face" },
    { value: "😉", label: "Winking face" },
    { value: "😍", label: "Heart eyes" },
    { value: "🥰", label: "Smiling with hearts" },
    { value: "😂", label: "Tears of joy" },
    { value: "😎", label: "Sunglasses" },
    { value: "🤔", label: "Thinking" },
    { value: "❤️", label: "Red heart" },
    { value: "💛", label: "Gold heart" },
    { value: "🔥", label: "Fire" },
    { value: "✨", label: "Sparkles" },
    { value: "🙌", label: "Raised hands" },
    { value: "👏", label: "Clapping" },
    { value: "👍", label: "Thumbs up" },
    { value: "👋", label: "Waving hand" },
    { value: "🎉", label: "Celebration" },
    { value: "💯", label: "Hundred points" },
  ],
} as const;
