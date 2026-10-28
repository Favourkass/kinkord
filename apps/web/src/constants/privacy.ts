import { Routes } from "./Routes";

export const PRIVACY_CATEGORIES = [
  {
    key: "profile",
    icon: "👤",
    label: "Profile & Personal Information Visibility",
    href: Routes.settingsPrivacyProfile,
  },
  {
    key: "messaging",
    icon: "💬",
    label: "Messaging, Friend Requests & Following",
    href: Routes.settingsPrivacyMessaging,
  },
  { key: "activity", icon: "🟢", label: "Activity Status", href: Routes.settingsPrivacyActivity },
  {
    key: "read-receipts",
    icon: "✓✓",
    label: "Read Receipts",
    href: Routes.settingsPrivacyReceipts,
  },
  { key: "tagging", icon: "🏷️", label: "Tagging & Mentions", href: Routes.settingsPrivacyTags },
  {
    key: "sharing",
    icon: "🔄",
    label: "Content Sharing & Reposting",
    href: Routes.settingsPrivacySharing,
  },
] as const;

export const PRIVACY_FIELDS = [
  { key: "directory", icon: "🔎", label: "Who Can Find Me in the Members Directory" },
  { key: "profilePhoto", icon: "🖼️", label: "Who Can See My Profile Photo" },
  { key: "coverPhoto", icon: "🎨", label: "Who Can See My Cover Photo" },
  { key: "bio", icon: "📝", label: "Who Can See My Bio/About Me" },
  { key: "location", icon: "📍", label: "Who Can See My Location" },
  { key: "interests", icon: "❤️", label: "Who Can See My Interests" },
  { key: "relationshipStatus", icon: "💞", label: "Who Can See My Relationship Status" },
  { key: "followersFollowing", icon: "👥", label: "Who Can See My Followers and Following" },
  { key: "posts", icon: "📰", label: "Who Can See My Posts" },
  { key: "media", icon: "📸", label: "Who Can See My Photos and Videos" },
  { key: "onlineStatus", icon: "🟢", label: "Who Can See My Online Status" },
  { key: "tagging", icon: "🏷️", label: "Who Can Tag or Mention Me" },
  { key: "stories", icon: "⏳", label: "Who Can See My Stories", unavailable: true },
  { key: "pinnedPosts", icon: "📌", label: "Who Can See My Pinned Posts", unavailable: true },
  { key: "sharedContent", icon: "🔗", label: "Who Can See My Content When it is shared" },
  { key: "search", icon: "🌐", label: "Who Can Find Me Through Kinkord Search" },
  { key: "readReceipts", icon: "✓✓", label: "Who Can See When I Have Read Their Messages" },
  { key: "messaging", icon: "💬", label: "Who Can Send Me a Message" },
] as const;

export const PRIVACY_AUDIENCES = [
  { value: "friends", label: "Friends" },
  { value: "followers", label: "Followers" },
  { value: "following", label: "People I follow" },
  { value: "members", label: "Kinkordians" },
  { value: "country", label: "People in my country" },
  { value: "continent", label: "People in my continent" },
  { value: "verified", label: "Verified members" },
  { value: "onlyMe", label: "Only me" },
] as const;

export const PRIVACY_COPY = {
  description:
    "All privacy settings work both ways. You can only see or interact with something if both your audience and the other member's audience allow it. For example, choosing Only me for your profile photo hides other members' profile photos from you too. Each post's own audience and your blocks still apply.",
  activityDescription:
    "Choose who can see when you are online. This works both ways: if you hide your online status from someone, you cannot see theirs.",
  messagingDescription:
    "Choose who can send you messages. This works both ways: you can message someone only when both of your messaging audiences allow it. Only me stops messages in both directions. Existing conversations remain available to read. Premium and daily limits still apply.",
  comingSoon: "Controls for this category are coming soon. Your current settings are unchanged.",
  hints: {
    directory:
      "Only me hides you from the directory and prevents you from browsing other members there. Community totals are unaffected.",
    sharedContent: "Also applies when someone opens a link to your post.",
    bio: "Also covers the rest of your About details: body type, languages, nationality, occupation, limits, social links and your verified badge.",
    interests: "Covers your kinks and what you are looking for.",
    media:
      "Covers your Media tab. Photos and videos in your posts follow each post's own audience.",
    onlineStatus:
      "This works both ways: if you hide your online status from someone, you cannot see theirs.",
    tagging:
      "Post tags are still limited to friends. This audience also controls who can send you mention notifications.",
  } as Partial<Record<string, string>>,
} as const;

export const READ_RECEIPTS_DESCRIPTION =
  "Choose who can see when you have read their messages. This works both ways: you only see their read receipts if you share yours with them. Only me hides read receipts in both directions. Sent and delivered indicators remain visible, and your unread counts still clear when you open a conversation.";
