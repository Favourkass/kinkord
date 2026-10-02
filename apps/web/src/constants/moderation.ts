/** Copy for the admin moderation screens. */
export const MODERATION_COPY = {
  title: "Admin",
  tabs: { members: "Members", reports: "Reports", blocklist: "Block list" },
  reports: {
    statuses: { open: "Open", resolved: "Resolved", dismissed: "Dismissed" },
    loading: "Loading reports…",
    empty: "Nothing to review.",
    reportedBy: "Reported by",
    deletedAccount: "a deleted account",
    details: "Their note",
    evidence: "Last messages in the chat",
    noEvidence: "No chat attached.",
    reported: "Reported",
    openMember: "Open member",
    resolve: "Resolve",
    dismiss: "Dismiss",
    photo: "Photo",
  },
  denied: "This area is for admins only.",
  checking: "Checking access…",
  search: {
    placeholder: "Name, @username, email or phone",
    newest: "Newest members",
    results: (q: string) => `Results for “${q}”`,
    empty: "No members match.",
  },
  member: {
    back: "All members",
    posts: "Posts",
    noPosts: "No posts.",
    rules: "Sign-up rules for this member",
    protected: "Admin accounts can't be blocked or deleted here.",
    actions: {
      block: "Block",
      unblock: "Unblock",
      deletePosts: "Delete all posts",
      deleteAccount: "Delete account",
      deletePost: "Delete",
    },
  },
  dialogs: {
    cancel: "Cancel",
    reasonLabel: "Reason (kept in the moderation log)",
    block: {
      title: "Block this member?",
      body: "They're signed out everywhere and can't sign in again. Their email and phone can't be used to sign up, and the IPs they used are flagged. Their profile and posts disappear from Kinkord.",
      checkbox: "Also delete all their posts",
      confirm: "Block",
    },
    unblock: {
      title: "Unblock this member?",
      body: "They can sign in again, and the sign-up rules written when they were blocked are removed.",
      confirm: "Unblock",
    },
    deletePosts: {
      title: "Delete all their posts?",
      body: "Every post and the photos in it are removed. This can't be undone.",
      confirm: "Delete posts",
    },
    deletePost: {
      title: "Delete this post?",
      body: "The post and its photos are removed. This can't be undone.",
      confirm: "Delete post",
    },
    deleteAccount: {
      title: "Delete this account?",
      body: "The account, posts, comments, likes, follows and photos are permanently deleted. This can't be undone.",
      checkbox: "Also stop them signing up again with the same email or phone",
      typeToConfirm: (phrase: string) => `Type ${phrase} to confirm`,
      confirm: "Delete account",
    },
  },
  notices: {
    blocked: (posts: number) =>
      posts > 0
        ? `Blocked, and ${posts} posts deleted.`
        : "Blocked. They've been signed out everywhere.",
    unblocked: "Unblocked.",
    postsDeleted: (n: number) => `${n} ${n === 1 ? "post" : "posts"} deleted.`,
    postDeleted: "Post deleted.",
  },
  blocklist: {
    intro:
      "Sign-ups and verification codes are checked against this list. Blocked entries are refused; flagged ones are let through and logged for you to review.",
    kindLabel: "Type",
    valueLabel: "Value",
    actionLabel: "What happens",
    reasonLabel: "Reason (optional)",
    add: "Add to list",
    remove: "Remove",
    empty: "The list is empty.",
    kinds: [
      {
        value: "email",
        label: "Email",
        hint: "e.g. name@gmail.com — dot and +tag variants are caught",
      },
      { value: "phone", label: "Phone", hint: "e.g. 0803 123 4567 or +2348031234567" },
      {
        value: "name",
        label: "Name contains",
        hint: "a rare name, e.g. a surname — flag is safer",
      },
      { value: "ip", label: "IP address", hint: "mobile IPs are shared — flag, don't block" },
    ],
    actions: [
      { value: "block", label: "Block" },
      { value: "flag", label: "Flag for review" },
    ],
  },
  settingsEntry: "Admin",
} as const;
